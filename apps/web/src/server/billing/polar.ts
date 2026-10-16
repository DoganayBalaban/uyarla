import { createPolar, webhooks } from "@polar-sh/sdk/2026-10"
import type { BillingEvent, BillingProvider } from "@/server/billing/provider"
import { WebhookSignatureError } from "@/server/billing/provider"

/**
 * Polar (DOG-34). Merchant of record: vergiyi ve faturayı Polar üstleniyor,
 * kart bilgisi uyarla'ya hiç gelmiyor. Kullanıcı kimliği ödeme oturumunda
 * `external_customer_id`, paket `metadata.plan` olarak gidiyor ve siparişle
 * geri dönüyor.
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
  }): Promise<{ url: string }>
  validateEvent(body: string, headers: Record<string, string>, secret: string): Promise<{ type: string; data: unknown }>
  isVerificationError(error: unknown): boolean
}

interface OrderData {
  id?: unknown
  metadata?: Record<string, unknown> | null
  customer?: { external_id?: unknown } | null
}

export function createPolarProvider(config: { webhookSecret: string }, deps: PolarDeps): BillingProvider {
  return {
    async createCheckout({ userId, email, productId, plan, successUrl }) {
      const checkout = await deps.createCheckout({
        products: [productId],
        external_customer_id: userId,
        customer_email: email,
        success_url: successUrl,
        metadata: { plan },
        locale: "tr",
      })
      return { url: checkout.url }
    },

    async parseWebhook(rawBody, headers): Promise<BillingEvent | null> {
      let event: { type: string; data: unknown }
      try {
        event = await deps.validateEvent(rawBody, headers, config.webhookSecret)
      } catch (error) {
        if (deps.isVerificationError(error)) throw new WebhookSignatureError()
        throw error
      }
      if (event.type !== "order.paid" && event.type !== "order.refunded") return null
      const order = event.data as OrderData
      if (typeof order.id !== "string") return null
      if (event.type === "order.refunded") return { type: "refunded", orderId: order.id }
      const userId = order.customer?.external_id
      const plan = order.metadata?.plan
      if (typeof userId !== "string" || !userId || typeof plan !== "string") return null
      return { type: "paid", orderId: order.id, userId, plan }
    },
  }
}

/** Gerçek SDK ile. `POLAR_SERVER` öntanımlı sandbox: üretime geçiş açık bir karar. */
export function polarProviderFromEnv(env: Record<string, string | undefined> = process.env): BillingProvider {
  const accessToken = env.POLAR_ACCESS_TOKEN
  const webhookSecret = env.POLAR_WEBHOOK_SECRET
  if (!accessToken || !webhookSecret) throw new Error("POLAR_ACCESS_TOKEN ve POLAR_WEBHOOK_SECRET gerekli")
  const polar = createPolar({ accessToken, environment: env.POLAR_SERVER === "production" ? "production" : "sandbox" })
  return createPolarProvider(
    { webhookSecret },
    {
      createCheckout: (body) => polar.checkouts.create(body),
      validateEvent: (body, headers, secret) => webhooks.validateEvent(body, headers, secret),
      isVerificationError: (error) => error instanceof webhooks.PolarWebhookVerificationError,
    },
  )
}
