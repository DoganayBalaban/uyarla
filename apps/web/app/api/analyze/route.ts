import { LocalFileStore, PermanentError } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { ANALYZE_JOB_OPTIONS } from "@uyarla/worker/queue"
import { NextResponse } from "next/server"
import { analyzeQueue } from "@/lib/queue"
import { validateUpload } from "@/lib/upload"

export const runtime = "nodejs"

/** Sprint 1'de kimlik doğrulama yok; tek yerel test kullanıcısı (spec §5). */
const TEST_USER_EMAIL = "test@uyarla.local"

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

    // Geçici: bu blok Görev 4'te anonim oturumla değiştirilecek. `name`
    // alanı Better Auth şemasında zorunlu olduğu için eklendi.
    const user = await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      update: {},
      create: { email: TEST_USER_EMAIL, name: "Test" },
    })

    const resume = await prisma.resume.create({
      data: { userId: user.id, filePath, rawText: "" },
    })

    const posting = await prisma.jobPosting.create({
      data: { rawText: jobText, requirements: [], language: "tr" },
    })

    const job = await analyzeQueue.add(
      "analyze",
      { resumeId: resume.id, jobPostingId: posting.id },
      ANALYZE_JOB_OPTIONS,
    )

    return NextResponse.json({ jobId: job.id })
  } catch (error) {
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
