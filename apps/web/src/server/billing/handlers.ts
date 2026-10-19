import * as Sentry from "@sentry/nextjs"
import type { prisma } from "@uyarla/db"
import { accessSnapshot } from "@/features/billing/access"
import { isPlanKey, type PlanOffer } from "@/features/billing/plans"
import { plansPath } from "@/features/billing/paywall"
import { applyBillingEvent, loadAccess } from "@/server/billing/entitlement"
import { WebhookSignatureError, type BillingProvider } from "@/server/billing/provider"

type Db = typeof prisma
type Reply = { status: number; json: unknown }

/**
 * Ödeme oturumu: paket listede olmalı; teşekkür sayfası `donus`u taşıyor.
 *
 * `odeme`: oturumun açıldığı an (DOG-80). Teşekkür sayfası yalnızca bundan
 * sonra açılan dönemi yeni ödeme sayıyor; kullanıcının önceden aktif bir
 * dönemi varsa eski bitiş tarihini "erişimin açıldı" diye göstermiyor.
 * Sunucu saati: durum ucunun döndüğü dönem zamanıyla aynı saat.
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
  const user = await input.db.user.findUniqueOrThrow({ where: { id: input.userId }, select: { email: true } })
  const query = new URLSearchParams(
    typeof body.returnTo === "string" ? plansPath(body.returnTo).replace(/^\/plans\??/, "") : "",
  )
  query.set("odeme", String((input.now ?? new Date()).getTime()))
  const { url } = await input.provider.createCheckout({
    userId: input.userId,
    email: user.email,
    productId: offer.productId,
    plan: offer.key,
    successUrl: `${input.baseUrl}/plans/tesekkurler?${query}`,
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

export async function handleStatus(input: { db: Db; userId: string; now: Date; unlimited?: boolean }): Promise<{
  passEndsAt: string | null
  /** En son açılan aktif dönemin oluşturulma zamanı; teşekkür sayfası için (DOG-80). */
  lastPassAt: string | null
  freeUsed: boolean
  freeLeft: number
  usedLast24h: number
  dailyCap: number
  unlimited: boolean
}> {
  const [access, last] = await Promise.all([
    loadAccess(input.db, input.userId, input.now),
    input.db.accessPass.findFirst({
      where: { userId: input.userId, status: "active" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ])
  const snap = accessSnapshot({ ...access, now: input.now })
  return {
    passEndsAt: snap.passEndsAt?.toISOString() ?? null,
    lastPassAt: last?.createdAt.toISOString() ?? null,
    freeUsed: snap.freeLeft === 0,
    freeLeft: snap.freeLeft,
    usedLast24h: snap.usedLast24h,
    dailyCap: snap.dailyCap,
    unlimited: input.unlimited ?? false,
  }
}
