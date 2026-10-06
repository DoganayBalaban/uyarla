import { fileStoreFromEnv, PermanentError } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { ANALYZE_JOB_OPTIONS } from "@uyarla/worker/queue"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "@/server/auth"
import { authErrorResponse, ensureRegistered, ensureSession, getSession } from "@/server/authz"
import { analyzeQueue } from "@/server/queue"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/server/rateLimit"
import { createResume, findLibraryResume } from "@/server/resumeLibrary"
import { validateJobText, validateUpload } from "@/server/upload"

export const runtime = "nodejs"

/**
 * İş oluşturma. Bu route ince: doğrular, kaydeder, kuyruğa atar.
 * 30 saniyelik LLM zinciri worker'da çalışıyor (K-02).
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const resumeIdField = form.get("resumeId")
    const libraryResumeId = typeof resumeIdField === "string" && resumeIdField ? resumeIdField : null
    const file = form.get("cv")

    // İki yol: kütüphanedeki CV (dosya yok) ya da yeni dosya. Doğrulama
    // oturumdan önce: geçersiz istek için anonim kullanıcı açılmasın.
    let jobText: string
    if (libraryResumeId) {
      jobText = validateJobText(String(form.get("jobText") ?? ""))
    } else {
      jobText = validateUpload(file, String(form.get("jobText") ?? "")).jobText
      // Şema dosya benzeri her nesneyi kabul ediyor; içeriği okumak için gerçek File gerek.
      if (!(file instanceof File)) {
        throw new PermanentError("CV'ni seçer misin? PDF ya da DOCX olabilir.", "missing_file")
      }
    }

    // Oturum yoksa anonim aç. Sayfa yüklenince değil burada: her ziyaretçiye
    // kullanıcı kaydı açmanın anlamı yok, sadece iş üretenlere gerekiyor
    // (spec §7). signInAnonymous'un kendi yanıtı kullanılıyor: getSession
    // İSTEK başlıklarını okuyor ve yeni çerez ancak sonraki istekte görünür.
    // Kayıtlı CV isteğinde anonim açılmıyor: kütüphane kayıtlıya açık.
    let session = await getSession()
    if (!session && !libraryResumeId) {
      const fresh = await auth.api.signInAnonymous({ headers: await headers() })
      session = fresh?.user ? { user: { id: fresh.user.id, isAnonymous: true } } : null
    }
    const { user } = libraryResumeId ? ensureRegistered(session) : ensureSession(session)

    // Pahalı uç: her çağrı ~60 saniyelik LLM işi başlatıyor (spec §9).
    await enforceRateLimit(
      redisStore,
      `analiz:${user.id}`,
      user.isAnonymous ? RATE_LIMITS.anonUser : RATE_LIMITS.registered,
    )

    let resumeId: string
    let savedToLibrary: boolean | undefined
    if (libraryResumeId) {
      // Aynı Resume satırı: worker rawText önbelleğini kullanıyor, dosya
      // yeniden okunmuyor. Başkasının ya da kaldırılmış CV 404 (K-35).
      resumeId = (await findLibraryResume(prisma, user.id, libraryResumeId)).id
    } else {
      const upload = file as File
      // Metin çıkarma worker'da yapılıyor, burada değil (spec §4.2): pdf-parse'ın
      // kullandığı pdfjs Next'in sunucu katmanında yüklenemiyor. Okunamayan
      // dosya kullanıcıya iş başarısız olduğunda bildiriliyor.
      const filePath = await fileStoreFromEnv().save(Buffer.from(await upload.arrayBuffer()), upload.name)
      const wantsSave = form.get("saveToLibrary") === "true" && !user.isAnonymous
      const created = await createResume(prisma, {
        userId: user.id,
        filePath,
        fileName: upload.name,
        saveToLibrary: wantsSave,
      })
      resumeId = created.resumeId
      if (wantsSave) savedToLibrary = created.savedToLibrary
    }

    const posting = await prisma.jobPosting.create({
      data: { userId: user.id, rawText: jobText, requirements: [], language: "tr" },
    })

    const job = await analyzeQueue.add(
      "analyze",
      { resumeId, jobPostingId: posting.id, userId: user.id },
      ANALYZE_JOB_OPTIONS,
    )

    return NextResponse.json({ jobId: job.id, ...(savedToLibrary !== undefined ? { savedToLibrary } : {}) })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    if (error instanceof PermanentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error("[api/analyze]", error)
    return NextResponse.json(
      { error: "Bir şeyler ters gitti. Birazdan tekrar dener misin?", code: "unknown" },
      { status: 500 },
    )
  }
}
