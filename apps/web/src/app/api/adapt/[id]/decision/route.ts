import { AdaptationDraftSchema } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import {
  adaptationDocument,
  applyBulkDecision,
  applyDecision,
  computeScoreAfter,
  loadAdaptation,
  nextStatus,
  type BulkDecision,
} from "@/server/adaptationDecision"
import { authErrorResponse, ensureOwner, getSession } from "@/server/authz"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Tek madde ({ itemId, decision }) ya da toplu karar ({ bulk }, DOG-93).
  // Ayrı bir route değil: Vercel Hobby'de deploy başına 12 fonksiyon sınırı var.
  const { itemId, decision, bulk } = (await request.json()) as {
    itemId?: string
    decision?: "accepted" | "rejected"
    bulk?: BulkDecision
  }

  const isBulk = bulk === "accept_verified" || bulk === "reject_all"
  if (!isBulk && (!itemId || (decision !== "accepted" && decision !== "rejected"))) {
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
    fresh = isBulk ? applyBulkDecision(payload.draft, bulk) : applyDecision(payload.draft, itemId!, decision!)
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
    // Belge görünümü kararla birlikte güncelleniyor (DOG-93).
    document: adaptationDocument(payload.profile, fresh),
  })
}
