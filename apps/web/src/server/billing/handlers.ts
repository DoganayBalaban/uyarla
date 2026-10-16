import * as Sentry from "@sentry/nextjs"
import type { prisma } from "@uyarla/db"
import { FREE_ADAPTATIONS, activePassEnd } from "@/features/billing/access"
import { isPlanKey, type PlanOffer } from "@/features/billing/plans"
import { plansPath } from "@/features/billing/paywall"
import { applyBillingEvent, loadAccess } from "@/server/billing/entitlement"
import { WebhookSignatureError, type BillingProvider } from "@/server/billing/provider"

type Db = typeof prisma
type Reply = { status: number; json: unknown }

/** Ödeme oturumu: paket listede olmalı; teşekkür sayfası `donus`u taşıyor. */
export async function handleCheckout(input: {
  db: Db
  provider: BillingProvider
  plans: PlanOffer[]
  userId: string
  body: unknown
  baseUrl: string
}): Promise<Reply> {
  const body = (input.body ?? {}) as { plan?: unknown; returnTo?: unknown }
  const offer = isPlanKey(body.plan) ? input.plans.find((p) => p.key === body.plan) : undefined
  if (!offer) return { status: 400, json: { error: "Bu paket şu an sunulmuyor.", code: "unknown_plan" } }
  const user = await input.db.user.findUniqueOrThrow({ where: { id: input.userId }, select: { email: true } })
  const back = typeof body.returnTo === "string" ? plansPath(body.returnTo).replace(/^\/plans/, "") : ""
  const { url } = await input.provider.createCheckout({
    userId: input.userId,
    email: user.email,
    productId: offer.productId,
    plan: offer.key,
    successUrl: `${input.baseUrl}/plans/tesekkurler${back}`,
  })
  return { status: 200, json: { url } }
}

/**
 * Sağlayıcı bildirimi. İmza geçersizse 403. Uygulanamayan olay (bilinmeyen
 * paket, silinmiş kullanıcı) da 200: sağlayıcı yeniden denemesin; loglanıyor.
 */
export async function handleWebhook(input: {
  db: Db
  provider: BillingProvider
  rawBody: string
  headers: Record<string, string>
  now: Date
  log?: (message: string, extra: unknown) => void
}): Promise<Reply> {
  // Varsayılan: Sentry uyarısı. Para alındı ama dönem açılmadıysa (silinmiş
  // hesap, bilinmeyen paket) birinin elle iade etmesi gerekiyor (spec §4).
  const log =
    input.log ??
    ((message: string, extra: unknown) => {
      console.warn(message, extra)
      Sentry.captureMessage(message, { level: "warning", extra: { event: extra } })
    })
  let event
  try {
    event = await input.provider.parseWebhook(input.rawBody, input.headers)
  } catch (error) {
    if (error instanceof WebhookSignatureError) return { status: 403, json: { error: "invalid_signature" } }
    throw error
  }
  if (!event) return { status: 200, json: { received: true } }
  const outcome = await applyBillingEvent(input.db, event, input.now)
  if (outcome === "ignored") log("[billing] uygulanamayan ödeme olayı", event)
  return { status: 200, json: { received: true, outcome } }
}

export async function handleStatus(input: { db: Db; userId: string; now: Date }): Promise<{ passEndsAt: string | null; freeUsed: boolean }> {
  const access = await loadAccess(input.db, input.userId, input.now)
  return {
    passEndsAt: activePassEnd(access.passes, input.now)?.toISOString() ?? null,
    freeUsed: access.adaptationsUsed >= FREE_ADAPTATIONS,
  }
}
