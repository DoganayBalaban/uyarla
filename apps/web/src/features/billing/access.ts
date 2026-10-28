
/** Abonelikte son 24 saatte en çok uyarlama; kötüye kullanım koruması. */
export const DAILY_CAP = 30

/** Ücretsiz katman: takvim ayı başına (DOG-158, K-107). */
export const FREE_QUOTA = { analyses: 5, adaptations: 1 } as const

export type Feature = "analysis" | "adaptation" | "interview_prep" | "practice" | "form_answer" | "linkedin_rewrite"
export type DenyCode = "analysis_quota" | "adaptation_quota" | "subscription_required" | "daily_cap"

/** Polar aboneliğinin bizde tutulan hâli; Prisma satırı buna uyuyor. */
export interface SubscriptionLike {
  status: string
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  trialEnd: Date | null
  endedAt: Date | null
  createdAt: Date
}

export interface Usage {
  /** Bu takvim ayında açılan ve başarısız olmayan analizler. */
  analysesThisMonth: number
  /** Bu takvim ayında açılan ve başarısız olmayan uyarlamalar. */
  adaptationsThisMonth: number
  adaptationsLast24h: number
}

export type Decision = { allowed: true; via: "free" | "subscription" | "admin" } | { allowed: false; code: DenyCode }

/**
 * Tek satırın erişim verip vermediği. Polar'da iptal edilen abonelik dönem
 * sonuna kadar `active` + `cancelAtPeriodEnd`; iade ya da iptal edilip biten
 * abonelik `canceled` ve `endedAt` dolu. Bilinmeyen durum erişim vermiyor.
 */
export function grantsAccess(sub: SubscriptionLike, now: Date): boolean {
  if (sub.endedAt && sub.endedAt <= now) return false
  const inPeriod = !!sub.currentPeriodEnd && now < sub.currentPeriodEnd
  switch (sub.status) {
    case "trialing":
    case "active":
      return true
    case "past_due":
      return inPeriod
    case "canceled":
      return inPeriod && sub.cancelAtPeriodEnd
    default:
      return false
  }
}

export function hasAccess(subs: SubscriptionLike[], now: Date): boolean {
  return subs.some((s) => grantsAccess(s, now))
}

/** Ekranda gösterilen abonelik: erişim veren, yoksa en yenisi. */
export function currentSubscription<T extends SubscriptionLike>(subs: T[], now: Date): T | null {
  const newest = [...subs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return newest.find((s) => grantsAccess(s, now)) ?? newest[0] ?? null
}

/** Deneme hesap başına bir kez: hiç aboneliği olmamış kullanıcıya. */
export function trialEligible(subs: SubscriptionLike[]): boolean {
  return subs.length === 0
}

/** İstanbul UTC+3 (2016'dan beri yaz saati yok). */
const ISTANBUL_OFFSET_MS = 3 * 36e5

/** İstanbul saatine göre bu ayın ilk anı (UTC). */
export function monthStart(now: Date): Date {
  const local = new Date(now.getTime() + ISTANBUL_OFFSET_MS)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - ISTANBUL_OFFSET_MS)
}

/** Kotanın yenileneceği an: İstanbul'da gelecek ayın 1'i 00:00. */
export function nextMonthStart(now: Date): Date {
  const local = new Date(now.getTime() + ISTANBUL_OFFSET_MS)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) - ISTANBUL_OFFSET_MS)
}

/**
 * Bir özelliğin kullanılıp kullanılamayacağı (spec §4.2). Abonelikte kota yok,
 * yalnızca uyarlamada günlük tavan; ücretsizde aylık kota, abonelik
 * özellikleri kapalı.
 */
export function decide(feature: Feature, input: { subs: SubscriptionLike[]; usage: Usage; now: Date; unlimited?: boolean }): Decision {
  if (input.unlimited) return { allowed: true, via: "admin" }
  if (hasAccess(input.subs, input.now)) {
    if (feature === "adaptation" && input.usage.adaptationsLast24h >= DAILY_CAP) return { allowed: false, code: "daily_cap" }
    return { allowed: true, via: "subscription" }
  }
  if (feature === "analysis") {
    return input.usage.analysesThisMonth < FREE_QUOTA.analyses ? { allowed: true, via: "free" } : { allowed: false, code: "analysis_quota" }
  }
  if (feature === "adaptation") {
    return input.usage.adaptationsThisMonth < FREE_QUOTA.adaptations ? { allowed: true, via: "free" } : { allowed: false, code: "adaptation_quota" }
  }
  return { allowed: false, code: "subscription_required" }
}
