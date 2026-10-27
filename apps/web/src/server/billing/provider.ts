/**
 * Ödeme sağlayıcısının arayüzü (DOG-34, abonelik DOG-158). İlk uygulama Polar;
 * şirket kurulunca iyzico/PayTR, hacim büyüyünce Paddle yalnızca bunu uygular.
 * Abonelik durumu bizim veritabanımızda (`Subscription`); sağlayıcı ödemeyi
 * alıp durum değişikliğini bildiriyor, iptal ve kart değişikliği onun portalında.
 */
export interface SubscriptionEvent {
  type: "subscription"
  subscriptionId: string
  userId: string
  plan: "month" | "quarter"
  status: string
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEnd: Date | null
  endedAt: Date | null
  /** Bildirimlerin sırası için; sırasız gelen eski bildirim yok sayılıyor. */
  modifiedAt: Date
}

export type BillingEvent = SubscriptionEvent

export interface BillingProvider {
  createCheckout(input: { userId: string; email: string; productId: string; plan: string; successUrl: string }): Promise<{ url: string }>
  /** Müşteri portalı: iptal, kart değişikliği, faturalar. */
  createPortalSession(input: { userId: string; returnUrl: string }): Promise<{ url: string }>
  /** Aboneliği hemen bitirir (hesap silindiğinde). */
  revokeSubscription(subscriptionId: string): Promise<void>
  /** İmza geçersizse `WebhookSignatureError`; ilgilenmediğimiz olaysa null. */
  parseWebhook(rawBody: string, headers: Record<string, string>): Promise<BillingEvent | null>
}

export class WebhookSignatureError extends Error {
  constructor() {
    super("Geçersiz webhook imzası")
    this.name = "WebhookSignatureError"
  }
}
