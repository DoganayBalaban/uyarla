import { AdaptationDraftSchema } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { applyDecision, computeScoreAfter, loadAdaptation, nextStatus } from "@/lib/adaptation"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { itemId, decision } = (await request.json()) as {
    itemId?: string
    decision?: "accepted" | "rejected"
  }

  if (!itemId || (decision !== "accepted" && decision !== "rejected")) {
    return NextResponse.json({ error: "Geçersiz karar." }, { status: 400 })
  }

  const yuk = await loadAdaptation(id)
  if (!yuk?.draft) {
    return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
  }

  let yeni
  try {
    yeni = applyDecision(yuk.draft, itemId, decision)
  } catch {
    return NextResponse.json({ error: "Madde bulunamadı." }, { status: 404 })
  }

  const status = nextStatus(yeni)
  await prisma.adaptation.update({
    where: { id },
    data: { draft: AdaptationDraftSchema.parse(yeni) as unknown as object, status },
  })

  return NextResponse.json({
    status,
    draft: yeni,
    scoreAfter: await computeScoreAfter(yuk.profile, yuk.posting, yeni),
  })
}
