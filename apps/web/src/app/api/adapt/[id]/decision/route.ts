import { AdaptationDraftSchema } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { applyDecision, computeScoreAfter, loadAdaptation, nextStatus } from "@/server/adaptationDecision"
import { authErrorResponse, ensureOwner, getSession } from "@/server/authz"

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

  const payload = await loadAdaptation(id)
  if (!payload?.draft) {
    return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
  }

  try {
    ensureOwner(payload.ownerId, await getSession())
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    throw error
  }

  let fresh
  try {
    fresh = applyDecision(payload.draft, itemId, decision)
  } catch {
    return NextResponse.json({ error: "Madde bulunamadı." }, { status: 404 })
  }

  const status = nextStatus(fresh)
  await prisma.adaptation.update({
    where: { id },
    data: { draft: AdaptationDraftSchema.parse(fresh) as unknown as object, status },
  })

  return NextResponse.json({
    status,
    draft: fresh,
    scoreAfter: await computeScoreAfter(payload.profile, payload.posting, fresh),
  })
}
