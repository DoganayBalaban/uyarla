import { createPolar, errors, webhooks } from "@polar-sh/sdk/2026-10"
import type { BillingEvent, BillingProvider } from "@/server/billing/provider"
import { WebhookSignatureError } from "@/server/billing/provider"

/**
 * Polar (DOG-34, abonelik DOG-158). Merchant of record: vergiyi ve faturayı
 * Polar üstleniyor, kart bilgisi uyarla'ya hiç gelmiyor. Abonelik durumu
 * bildirimlerle geliyor; plan ürün kimliğinden okunuyor. Kullanıcı kimliği
 * ödeme oturumunun `metadata`'sında gidip abonelikle geri dönüyor; yedek
 * `external_customer_id` (o Polar müşteri kaydına bağlı: aynı e-postayla daha
 * önce açılmış müşteri başka kimlik taşıyabilir, bu yüzden metadata önce).
 *
 * SDK çağrıları `PolarDeps` arkasında: testte sahte, üretimde gerçek SDK.
 */
export interface PolarDeps {
  createCheckout(body: {
    products: string[]
    external_customer_id: string
    customer_email: string
    success_url: string
    metadata: Record<string, string>
    locale: string
    allow_trial: boolean
  }): Promise<{ url: string }>
  createCustomerSession(
    body: { external_customer_id: string; return_url: string } | { customer_id: string; return_url: string },
  ): Promise<{ customer_portal_url: string }>
  revokeSubscription(id: string): Promise<unknown>
  validateEvent(body: string, headers: Record<string, string>, secret: string): Promise<{ type: string; data: unknown }>
  isVerificationError(error: unknown): boolean
  /** SDK'nın tanımadığı olay türü; 500 dönersek Polar durmadan yeniden dener. */
  isUnknownTypeError(error: unknown): boolean
  /** Abonelik Polar'da zaten iptal edilmiş ya da hiç yok: iptal edilmiş sayılır. */
  isGoneSubscriptionError(error: unknown): boolean
}

/** Abonelik durumunu değiştiren bildirimler; hepsi aynı yere gidiyor (spec §4.3). */
const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.revoked",
  "subscription.past_due",
])

interface SubscriptionData {
  id?: unknown
  status?: unknown
  product_id?: unknown
  current_period_end?: unknown
  cancel_at_period_end?: unknown
  trial_end?: unknown
  ended_at?: unknown
  created_at?: unknown
  modified_at?: unknown
  metadata?: Record<string, unknown> | null
  customer_id?: unknown
  customer?: { external_id?: unknown } | null
}

const date = (v: unknown) => (typeof v === "string" && v ? new Date(v) : null)

export function createPolarProvider(
  config: { webhookSecret: string; products: Partial<Record<"month" | "quarter", string | undefined>> },
  deps: PolarDeps,
): BillingProvider {
  const planOf = (productId: unknown) =>
    (Object.entries(config.products).find(([, id]) => id && id === productId)?.[0] as "month" | "quarter" | undefined) ?? null
  return {
    async createCheckout({ userId, email, productId, plan, successUrl, allowTrial }) {
      const checkout = await deps.createCheckout({
        products: [productId],
        external_customer_id: userId,
        customer_email: email,
        success_url: successUrl,
        metadata: { plan, user_id: userId },
        locale: "tr",
        // Polar'ın kendi deneme kuralı değil, ekranda gösterdiğimiz hak geçerli.
        allow_trial: allowTrial,
      })
      return { url: checkout.url }
    },

    async createPortalSession({ userId, customerId, returnUrl }) {
      // Aynı e-postayla önce açılmış Polar müşterisi başka dış kimlik taşıyabilir;
      // bildirimden kaydettiğimiz müşteri kimliği her zaman doğru kayda gider.
      const session = await deps.createCustomerSession(
        customerId ? { customer_id: customerId, return_url: returnUrl } : { external_customer_id: userId, return_url: returnUrl },
      )
      return { url: session.customer_portal_url }
    },

    async revokeSubscription(id) {
      try {
        await deps.revokeSubscription(id)
      } catch (error) {
        // Zaten bitmiş abonelik iptal edilmiş sayılıyor; yoksa hesap silme
        // ona takılıp hiç ilerlemezdi (K-111).
        if (!deps.isGoneSubscriptionError(error)) throw error
      }
    },

    async parseWebhook(rawBody, headers): Promise<BillingEvent | null> {
      let event: { type: string; data: unknown }
      try {
        event = await deps.validateEvent(rawBody, headers, config.webhookSecret)
      } catch (error) {
        if (deps.isVerificationError(error)) throw new WebhookSignatureError()
        if (deps.isUnknownTypeError(error)) return null
        throw error
      }
      if (!SUBSCRIPTION_EVENTS.has(event.type)) return null
      const s = event.data as SubscriptionData
      const userId = s.metadata?.user_id || s.customer?.external_id
      const modifiedAt = date(s.modified_at) ?? date(s.created_at)
      if (typeof s.id !== "string" || typeof s.status !== "string" || !modifiedAt) return null
      // Sessizce düşmesin (son inceleme): para alınmış ama erişim açılmamış olabilir.
      if (typeof userId !== "string" || !userId) return { type: "unmatched", subscriptionId: s.id, reason: "user" }
      return {
        type: "subscription",
        subscriptionId: s.id,
        userId,
        plan: planOf(s.product_id) ?? "unknown",
        status: s.status,
        currentPeriodEnd: date(s.current_period_end),
        cancelAtPeriodEnd: s.cancel_at_period_end === true,
        trialEnd: date(s.trial_end),
        endedAt: date(s.ended_at),
        modifiedAt,
        customerId: typeof s.customer_id === "string" && s.customer_id ? s.customer_id : null,
      }
    },
  }
}

/** Gerçek SDK ile. `POLAR_SERVER` öntanımlı sandbox: üretime geçiş açık bir karar. */
/**
 * Polar ortam değişkenleri eksik (DOG-80). Ayrı sınıf: route bunu ödeme
 * sayfasının genel hatasından ayırıp anlamlı bir yanıt ve Sentry kaydı
 * üretiyor. Bildirim ucunda sessiz kalırsa para alınıp dönem açılmaz.
 */
export class BillingNotConfiguredError extends Error {
  constructor() {
    super("POLAR_ACCESS_TOKEN ve POLAR_WEBHOOK_SECRET gerekli")
    this.name = "BillingNotConfiguredError"
  }
}

export function polarProviderFromEnv(env: Record<string, string | undefined> = process.env): BillingProvider {
  const accessToken = env.POLAR_ACCESS_TOKEN
  const webhookSecret = env.POLAR_WEBHOOK_SECRET
  if (!accessToken || !webhookSecret) throw new BillingNotConfiguredError()
  const polar = createPolar({ accessToken, environment: env.POLAR_SERVER === "production" ? "production" : "sandbox" })
  return createPolarProvider(
    { webhookSecret, products: { month: env.POLAR_PRODUCT_MONTH?.trim(), quarter: env.POLAR_PRODUCT_QUARTER?.trim() } },
    {
      createCheckout: (body) => polar.checkouts.create(body),
      createCustomerSession: (body) => polar.customerSessions.create(body),
      revokeSubscription: (id) => polar.subscriptions.revoke(id),
      validateEvent: (body, headers, secret) => webhooks.validateEvent(body, headers, secret),
      isVerificationError: (error) => error instanceof webhooks.PolarWebhookVerificationError,
      isUnknownTypeError: (error) => error instanceof webhooks.PolarWebhookUnknownTypeError,
      isGoneSubscriptionError: (error) => error instanceof errors.AlreadyCanceledSubscription || error instanceof errors.ResourceNotFound,
    },
  )
}
