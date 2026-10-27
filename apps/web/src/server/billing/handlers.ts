import * as Sentry from "@sentry/nextjs"
import type { prisma } from "@uyarla/db"
import { DAILY_CAP, FREE_QUOTA, currentSubscription, hasAccess, nextMonthStart, trialEligible } from "@/features/billing/access"
import type { BillingStatus } from "@/features/billing/api"
import { isPlanKey, type PlanOffer } from "@/features/billing/plans"
import { plansPath } from "@/features/billing/paywall"
import { loadUsage, userHasAccess } from "@/server/billing/entitlement"
import { applySubscriptionEvent } from "@/server/billing/subscriptions"
import { WebhookSignatureError, type BillingProvider } from "@/server/billing/provider"

type Db = typeof prisma
type Reply = { status: number; json: unknown }

/**
 * Abonelik ödeme sayfası (DOG-158). Paket listede olmalı; teşekkür sayfası
 * `donus`u taşıyor. Aktif abone ikinci abonelik açmasın: paket değişikliği ve
 * iptal Polar portalında, ona gidiyor.
 *
 * `odeme`: oturumun açıldığı an (DOG-80). Teşekkür sayfası yalnızca bundan
 * sonra açılan aboneliği yeni ödeme sayıyor.
 */
export async function handleCheckout(input: {
  db: Db
  provider: BillingProvider
  plans: PlanOffer[]
  userId: string
  body: unknown
  baseUrl: string
  now?: Date
}): Promise<Reply> {
  const body = (input.body ?? {}) as { plan?: unknown; returnTo?: unknown }
  const offer = isPlanKey(body.plan) ? input.plans.find((p) => p.key === body.plan) : undefined
  if (!offer) return { status: 400, json: { error: "Bu paket şu an sunulmuyor.", code: "unknown_plan" } }
  const now = input.now ?? new Date()
  if (await userHasAccess(input.db, input.userId, now)) {
    const { url } = await input.provider.createPortalSession({ userId: input.userId, returnUrl: `${input.baseUrl}/account` })
    return { status: 200, json: { url } }
  }
  const user = await input.db.user.findUniqueOrThrow({ where: { id: input.userId }, select: { email: true } })
  const query = new URLSearchParams(
    typeof body.returnTo === "string" ? plansPath(body.returnTo).replace(/^\/plans\??/, "") : "",
  )
  query.set("odeme", String(now.getTime()))
  const { url } = await input.provider.createCheckout({
    userId: input.userId,
    email: user.email,
    productId: offer.productId,
    plan: offer.key,
    successUrl: `${input.baseUrl}/plans/thanks?${query}`,
  })
  return { status: 200, json: { url } }
}

/** "Aboneliği yönet": iptal, kart ve faturalar Polar müşteri portalında. */
export async function handlePortal(input: { db: Db; provider: BillingProvider; userId: string; baseUrl: string }): Promise<Reply> {
  const has = await input.db.subscription.count({ where: { userId: input.userId } })
  if (!has) return { status: 404, json: { error: "Aboneliğin yok.", code: "no_subscription" } }
  const { url } = await input.provider.createPortalSession({ userId: input.userId, returnUrl: `${input.baseUrl}/account` })
  return { status: 200, json: { url } }
}

/**
 * Sağlayıcı bildirimi. İmza geçersizse 403. Uygulanamayan olay (silinmiş
 * kullanıcı) da 200: sağlayıcı yeniden denemesin; abonelik Polar'da iptal
 * ediliyor ki silinmiş hesaptan ücret çekilmesin, ve loglanıyor.
 */
export async function handleWebhook(input: {
  db: Db
  provider: BillingProvider
  rawBody: string
  headers: Record<string, string>
  now: Date
  log?: (message: string, extra: unknown) => void
}): Promise<Reply> {
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
  const outcome = await applySubscriptionEvent(input.db, event)
  if (outcome === "ignored") {
    log("[billing] kullanıcısı olmayan abonelik iptal ediliyor", event)
    const id = event.subscriptionId
    await input.provider.revokeSubscription(id).catch((error: unknown) => log("[billing] abonelik iptal edilemedi", { id, error: String(error) }))
  }
  return { status: 200, json: { received: true, outcome } }
}

/** Abonelik ve bu ayki kota (DOG-158); paket ekranı, sayaçlar ve teşekkür sayfası. */
export async function handleStatus(input: { db: Db; userId: string; now: Date; unlimited?: boolean; plans: PlanOffer[] }): Promise<BillingStatus> {
  const { subs, usage } = await loadUsage(input.db, input.userId, input.now)
  const unlimited = input.unlimited ?? false
  const access = unlimited || hasAccess(subs, input.now)
  const sub = currentSubscription(subs, input.now)
  return {
    access,
    unlimited,
    trialEligible: trialEligible(subs),
    subscription: sub
      ? {
          plan: sub.plan,
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          trialEnd: sub.trialEnd?.toISOString() ?? null,
          createdAt: sub.createdAt.toISOString(),
          priceTry: input.plans.find((p) => p.key === sub.plan)?.priceTry ?? null,
        }
      : null,
    quota: access
      ? null
      : {
          analyses: { used: usage.analysesThisMonth, limit: FREE_QUOTA.analyses },
          adaptations: { used: usage.adaptationsThisMonth, limit: FREE_QUOTA.adaptations },
          resetsAt: nextMonthStart(input.now).toISOString(),
        },
    usedLast24h: usage.adaptationsLast24h,
    dailyCap: DAILY_CAP,
  }
}
