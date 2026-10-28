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
  /** "unknown": ürün kimliği ayarlardakilerden değil (eski fiyat); durum yine işleniyor. */
  plan: "month" | "quarter" | "unknown"
  status: string
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEnd: Date | null
  endedAt: Date | null
  /** Bildirimlerin sırası için; sırasız gelen eski bildirim yok sayılıyor. */
  modifiedAt: Date
  /** Polar müşteri kimliği; portal bununla açılıyor. */
  customerId: string | null
}

/** Abonelik bildirimi geldi ama kullanıcımıza bağlanamadı: uyarı düşülüyor. */
export interface UnmatchedEvent {
  type: "unmatched"
  subscriptionId: string
  reason: "user"
}

export type BillingEvent = SubscriptionEvent | UnmatchedEvent

export interface BillingProvider {
  /** `allowTrial`: deneme hakkını biz veriyoruz (hiç aboneliği olmamış kullanıcı). */
  createCheckout(input: { userId: string; email: string; productId: string; plan: string; successUrl: string; allowTrial: boolean }): Promise<{ url: string }>
  /** Müşteri portalı: iptal, kart değişikliği, faturalar. `customerId` biliniyorsa onunla. */
  createPortalSession(input: { userId: string; customerId: string | null; returnUrl: string }): Promise<{ url: string }>
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
