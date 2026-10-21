import { AdaptationDraftSchema } from "@uyarla/core/schemas/adaptation"
import { EDIT_MAX_LENGTH, editDraftItem } from "@uyarla/core/adapt/edit"
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
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/server/rateLimit"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  // Tek madde ({ itemId, decision }), toplu karar ({ bulk }), belge stratejisi
  // ({ layout }) ya da tek sayfa için çıkarılan maddeyi geri alma ({ restore }),
  // hepsi DOG-93. Ayrı route'lar değil: Vercel Hobby'de deploy başına 12
  // fonksiyon sınırı var. Metni elle düzenleme ({ itemId, edit }) DOG-92.
  const { itemId, decision, bulk, layout, restore, edit, preview } = (await request.json()) as {
    itemId?: string
    decision?: "accepted" | "rejected"
    bulk?: BulkDecision
    layout?: "full" | "onePage"
    restore?: string
    edit?: string
    /** Yazarken canlı skor (DOG-92): düzenlemeyi kaydetmeden skorla. */
    preview?: boolean
  }

  const isBulk = bulk === "accept_verified" || bulk === "reject_all"
  const isLayout = layout === "full" || layout === "onePage"
  const isRestore = typeof restore === "string" && restore.length > 0
  const isEdit = typeof edit === "string" && !!itemId
  if (isEdit && (!edit.trim() || edit.trim().length > EDIT_MAX_LENGTH)) {
    return NextResponse.json({ error: `Metin boş olamaz ve en fazla ${EDIT_MAX_LENGTH} karakter olabilir.` }, { status: 400 })
  }
  if (!isBulk && !isLayout && !isRestore && !isEdit && (!itemId || (decision !== "accepted" && decision !== "rejected"))) {
    return NextResponse.json({ error: "Geçersiz karar." }, { status: 400 })
  }

  const payload = await loadAdaptation(id)
  if (!payload?.draft) {
    return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
  }

  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession()
    ensureOwner(payload.ownerId, session)
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
  } else if (isEdit) {
    if (!payload.profile) return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
    try {
      fresh = editDraftItem(payload.draft, itemId!, edit!, { profile: payload.profile, posting: payload.posting })
    } catch {
      return NextResponse.json({ error: "Madde bulunamadı." }, { status: 404 })
    }
    // Önizleme kaydedilmiyor: yalnızca bu metinle skor ve kontrol sonucu.
    if (preview === true) {
      try {
        await enforceRateLimit(redisStore, `onizleme:${session!.user.id}`, RATE_LIMITS.scorePreview)
      } catch (error) {
        const reply = authErrorResponse(error)
        if (reply) return reply
        throw error
      }
      const item = itemId === "summary" ? fresh.summary : fresh.bullets.find((b) => b.id === itemId)
      return NextResponse.json({
        preview: true,
        scoreAfter: await computeScoreAfter(payload.profile, payload.scoringPosting, fresh, payload.excluded),
        verification: item?.verification ?? null,
      })
    }
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
    scoreAfter: await computeScoreAfter(payload.profile, payload.scoringPosting, fresh, payload.excluded),
    // Belge görünümü kararla birlikte güncelleniyor (DOG-93).
    document: adaptationDocument(payload.profile, fresh),
    // Tek sayfa planının sonucu; yalnızca strateji seçildiğinde.
    ...(onePage ? { onePage } : {}),
  })
}
