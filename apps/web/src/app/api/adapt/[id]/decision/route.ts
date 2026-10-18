import { AdaptationDraftSchema } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import {
  adaptationDocument,
  applyBulkDecision,
  applyDecision,
  applyLayout,
  computeScoreAfter,
  loadAdaptation,
  nextStatus,
  restoreBullet,
  type BulkDecision,
} from "@/server/adaptationDecision"
import { authErrorResponse, ensureOwner, getSession } from "@/server/authz"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Tek madde ({ itemId, decision }), toplu karar ({ bulk }), belge stratejisi
  // ({ layout }) ya da tek sayfa için çıkarılan maddeyi geri alma ({ restore }),
  // hepsi DOG-93. Ayrı route'lar değil: Vercel Hobby'de deploy başına 12
  // fonksiyon sınırı var.
  const { itemId, decision, bulk, layout, restore } = (await request.json()) as {
    itemId?: string
    decision?: "accepted" | "rejected"
    bulk?: BulkDecision
    layout?: "full" | "onePage"
    restore?: string
  }

  const isBulk = bulk === "accept_verified" || bulk === "reject_all"
  const isLayout = layout === "full" || layout === "onePage"
  const isRestore = typeof restore === "string" && restore.length > 0
  if (!isBulk && !isLayout && !isRestore && (!itemId || (decision !== "accepted" && decision !== "rejected"))) {
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
  let onePage: { fits: boolean; pages: number } | null = null
  if (isLayout) {
    if (!payload.profile) return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
    ;({ draft: fresh, onePage } = await applyLayout(
      {
        profile: payload.profile,
        posting: payload.posting,
        draft: payload.draft,
        ownerId: payload.ownerId!,
        excluded: payload.excluded,
      },
      layout,
    ))
  } else {
    try {
      fresh = isBulk
        ? applyBulkDecision(payload.draft, bulk)
        : isRestore
          ? restoreBullet(payload.draft, restore)
          : applyDecision(payload.draft, itemId!, decision!)
    } catch {
      return NextResponse.json({ error: "Madde bulunamadı." }, { status: 404 })
    }
  }

  const status = nextStatus(fresh)
  await prisma.adaptation.update({
    where: { id },
    data: { draft: AdaptationDraftSchema.parse(fresh) as unknown as object, status },
  })

  return NextResponse.json({
    status,
    draft: fresh,
    scoreAfter: await computeScoreAfter(payload.profile, payload.posting, fresh, payload.excluded),
    // Belge görünümü kararla birlikte güncelleniyor (DOG-93).
    document: adaptationDocument(payload.profile, fresh),
    // Tek sayfa planının sonucu; yalnızca strateji seçildiğinde.
    ...(onePage ? { onePage } : {}),
  })
}
