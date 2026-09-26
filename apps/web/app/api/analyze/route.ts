import { LocalFileStore, PermanentError } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { ANALYZE_JOB_OPTIONS } from "@uyarla/worker/queue"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { authErrorResponse, ensureSession, getSession } from "@/lib/authz"
import { analyzeQueue } from "@/lib/queue"
import { validateUpload } from "@/lib/upload"

export const runtime = "nodejs"

/**
 * İş oluşturma. Bu route ince: doğrular, kaydeder, kuyruğa atar.
 * 30 saniyelik LLM zinciri worker'da çalışıyor (K-02).
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("cv")
    const jobText = String(form.get("jobText") ?? "")

    if (!(file instanceof File)) {
      throw new PermanentError("CV dosyası bulunamadı.", "missing_file")
    }
    validateUpload({ name: file.name, size: file.size }, jobText)

    const buffer = Buffer.from(await file.arrayBuffer())
    const store = new LocalFileStore(process.env.STORAGE_DIR ?? "./storage")
    const filePath = await store.save(buffer, file.name)

    // Metin çıkarma worker'da yapılıyor, burada değil (spec §4.2: route'ların
    // tek işi doğrulama ve kuyruğa devretmek). Teknik zorunluluk da var:
    // pdf-parse'ın kullandığı pdfjs Next'in sunucu katmanında yüklenemiyor.
    // Okunamayan dosya kullanıcıya iş başarısız olduğunda bildiriliyor.

    // Oturum yoksa anonim aç. Sayfa yüklenince değil burada: her ziyaretçiye
    // kullanıcı kaydı açmanın anlamı yok, sadece iş üretenlere gerekiyor
    // (spec §7).
    let oturum = await getSession()
    if (!oturum) {
      // signInAnonymous'un kendi yanıtı kullanılıyor. getSession'ı tekrar
      // çağırmak işe yaramıyor: o İSTEK başlıklarını okuyor ve yeni çerez
      // henüz orada değil — nextCookies onu YANITA yazıyor, yani ancak
      // sonraki istekte görünür hâle geliyor.
      const yeni = await auth.api.signInAnonymous({ headers: await headers() })
      oturum = yeni?.user ? { user: { id: yeni.user.id, isAnonymous: true } } : null
    }
    const { user } = ensureSession(oturum)

    const resume = await prisma.resume.create({
      data: { userId: user.id, filePath, rawText: "" },
    })

    const posting = await prisma.jobPosting.create({
      data: { userId: user.id, rawText: jobText, requirements: [], language: "tr" },
    })

    const job = await analyzeQueue.add(
      "analyze",
      { resumeId: resume.id, jobPostingId: posting.id, userId: user.id },
      ANALYZE_JOB_OPTIONS,
    )

    return NextResponse.json({ jobId: job.id })
  } catch (error) {
    const yetkiYaniti = authErrorResponse(error)
    if (yetkiYaniti) return yetkiYaniti
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
