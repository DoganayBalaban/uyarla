import type { PlanKey } from "@/features/billing/plans"

/**
 * Ödeme sağlayıcısının arayüzü (DOG-34). İlk uygulama Polar; şirket
 * kurulunca iyzico/PayTR, hacim büyüyünce Paddle yalnızca bunu uygular.
 * Dönemler bizim veritabanımızda; sağlayıcı yalnızca ödeme alıp haber verir.
 */
export type BillingEvent =
  | { type: "paid"; orderId: string; userId: string; plan: string }
  | { type: "refunded"; orderId: string }

export interface BillingProvider {
  createCheckout(input: {
    userId: string
    email: string
    productId: string
    plan: PlanKey
    successUrl: string
  }): Promise<{ url: string }>
  /** İmza geçersizse `WebhookSignatureError`; ilgilenmediğimiz olaysa null. */
  parseWebhook(rawBody: string, headers: Record<string, string>): Promise<BillingEvent | null>
}

export class WebhookSignatureError extends Error {
  constructor() {
    super("Geçersiz webhook imzası")
    this.name = "WebhookSignatureError"
  }
}
