import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { analyzeQueue } from "@/lib/queue"

export const runtime = "nodejs"

/** Durum ve sonuç sorgulama. Arayüz bunu saniyede bir yokluyor. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const job = await analyzeQueue.getJob(id)

  if (!job) {
    return NextResponse.json({ error: "İş bulunamadı." }, { status: 404 })
  }

  const state = await job.getState()

  if (state === "completed") {
    const analysisId = job.returnvalue
    const analysis = analysisId
      ? await prisma.analysis.findUnique({ where: { id: analysisId } })
      : null

    return NextResponse.json({
      status: "completed",
      // Uyarlama bu kimlikle başlatılıyor (spec §4); iş kimliği kuyruk
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
}
