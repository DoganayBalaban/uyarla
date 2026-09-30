import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, getSession } from "@/server/authz"

export const runtime = "nodejs"

/**
 * Bir analizin sonucu, analiz kimliğiyle.
 *
 * `/api/analyze/[jobId]` kuyruk işine bakıyor ve iş kuyruktan temizlenince
 * sonuç kayboluyordu; sayfa yenilenince de iş kimliği elde kalmıyordu (K3).
 * Analiz kaydı kalıcı: `/analyze?analiz=<id>` bu uçtan besleniyor, panodaki
 * kart ve sağ alttaki bildirim de buraya bağlanıyor.
 *
 * Yanıt biçimi `/api/analyze/[jobId]`'nin "completed" yanıtıyla aynı ki
 * analiz sayfası ikisini aynı kodla gösterebilsin.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const analysis = await prisma.analysis.findUnique({ where: { id } })
    ensureOwner(analysis?.userId ?? null, await getSession())

    if (analysis!.status === "running") return NextResponse.json({ status: "running" })
    if (analysis!.status === "failed") {
      return NextResponse.json({ status: "failed", error: "Bu analiz tamamlanamadı." })
    }

    return NextResponse.json({
      status: "completed",
      analysisId: analysis!.id,
      score: analysis!.score,
      result: analysis!.result,
      durationMs: analysis!.durationMs,
      tokenUsage: analysis!.tokenUsage,
      modelId: analysis!.modelId,
    })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/analysis/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
