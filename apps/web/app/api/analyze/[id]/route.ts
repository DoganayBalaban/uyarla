import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, getSession } from "@/lib/authz"
import { analyzeQueue } from "@/lib/queue"

export const runtime = "nodejs"

/** Durum ve sonuç sorgulama. Arayüz bunu saniyede bir yokluyor. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const job = await analyzeQueue.getJob(id)
    if (!job) return NextResponse.json({ error: "İş bulunamadı." }, { status: 404 })

    const state = await job.getState()

    if (state === "completed") {
      const analysisId = job.returnvalue
      const analysis = analysisId
        ? await prisma.analysis.findUnique({ where: { id: analysisId } })
        : null

      // Sahiplik analiz kaydında. Bu kontrol şart: BullMQ iş kimliği artan
      // tam sayı, yani /api/analyze/7 tahmin edilebilir ve kontrolsüz
      // bırakılırsa başkasının skoru okunabilir.
      ensureOwner(analysis?.userId ?? null, await getSession())

      return NextResponse.json({
        status: "completed",
        // Uyarlama bu kimlikle başlatılıyor; iş kimliği kuyruk
        // temizlendiğinde kayboluyor, analiz kimliği kalıcı.
        analysisId: analysisId ?? null,
        score: analysis?.score ?? null,
        result: analysis?.result ?? null,
        durationMs: analysis?.durationMs ?? null,
        tokenUsage: analysis?.tokenUsage ?? null,
        modelId: analysis?.modelId ?? null,
      })
    }

    if (state === "failed") {
      return NextResponse.json({
        status: "failed",
        error: job.failedReason ?? "Analiz tamamlanamadı.",
      })
    }

    const progress = job.progress as { stage?: string } | number
    return NextResponse.json({
      status: "running",
      stage: typeof progress === "object" ? progress.stage : undefined,
    })
  } catch (error) {
    const yanit = authErrorResponse(error)
    if (yanit) return yanit
    console.error("[api/analyze/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
