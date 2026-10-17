import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, getSession } from "@/server/authz"
import { setRequirementExcluded } from "@/server/requirementExclusion"

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

/**
 * Bir gereksinimi "ilanda yok, yanlış okunmuş" diye işaretler ya da geri alır
 * (DOG-90). Ayrı route değil: Vercel Hobby'de deploy başına 12 fonksiyon var.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { requirementIndex?: unknown; excluded?: unknown }
  if (typeof body.requirementIndex !== "number" || typeof body.excluded !== "boolean") {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
  }
  try {
    const analysis = await prisma.analysis.findUnique({ where: { id } })
    ensureOwner(analysis?.userId ?? null, await getSession())
    if (analysis!.status !== "done" || !analysis!.result) {
      return NextResponse.json({ error: "Analiz henüz tamamlanmadı." }, { status: 409 })
    }

    const result = analysis!.result as { requirements: unknown[]; excluded?: number[] }
    let excluded: number[]
    try {
      excluded = setRequirementExcluded(result, body.requirementIndex, body.excluded)
    } catch {
      return NextResponse.json({ error: "Gereksinim bulunamadı." }, { status: 404 })
    }

    // Yalnızca işaretler saklanıyor; düzeltilmiş skoru ekran hesaplıyor
    // (features/analysis/exclusion.ts). Bu dosya @uyarla/core içe aktarmıyor:
    // aktarınca Vercel route'u ayrı bir fonksiyona taşıyor ve Hobby'nin 12
    // fonksiyon sınırı aşılıyor (DOG-90, PR 117'nin ilk denemesi).
    const updated = { ...result, excluded }
    await prisma.analysis.update({ where: { id }, data: { result: updated as object } })
    return NextResponse.json({ result: updated })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/analysis/[id]] PATCH", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
