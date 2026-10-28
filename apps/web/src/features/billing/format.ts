import type { BillingStatus } from "@/features/billing/api"
import type { PlanKey } from "@/features/billing/plans"

export const PLAN_LABEL: Record<PlanKey, string> = { month: "1 Ay", quarter: "3 Ay" }

const DAY = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" })

/** İstanbul gününe göre Türkçe tarih: "1 Aralık 2026". */
export function formatDay(iso: string): string {
  return DAY.format(new Date(iso))
}

const HOUR_MS = 36e5

/** Dönemin kalan süresi: gün yukarı yuvarlanır, son günde saat. */
export function timeLeft(endIso: string, now: Date): string {
  const ms = new Date(endIso).getTime() - now.getTime()
  if (ms < HOUR_MS) return "1 saatten az kaldı"
  if (ms < 24 * HOUR_MS) return `${Math.ceil(ms / HOUR_MS)} saat kaldı`
  return `${Math.ceil(ms / (24 * HOUR_MS))} gün kaldı`
}

export interface AccessSummary {
  title: string
  detail: string | null
  /** Üst menüdeki kısa rozet. */
  badge: string
  /** Paket ekranına giden bağlantının metni. */
  cta: string
}

const PLAN_NAME: Record<string, string> = { month: "1 Ay", quarter: "3 Ay" }
const money = (n: number | null) => (n === null ? null : `${n} ₺`)

/**
 * Hak durumu (DOG-81, DOG-158): Hesabım, paket ekranı ve menü aynı metni
 * kullanıyor. Günlük sınır kayan 24 saat; "yarın" denmiyor.
 */
export function accessSummary(status: BillingStatus, now: Date): AccessSummary {
  if (status.unlimited) return { title: "Yönetici hesabı: her şey sınırsız", detail: null, badge: "Sınırsız", cta: "Paketleri gör" }
  const sub = status.subscription
  if (status.access && sub) {
    const manage = "Aboneliği yönet"
    if (sub.status === "trialing" && sub.trialEnd) {
      const left = timeLeft(sub.trialEnd, now)
      return {
        title: `Denemedesin · ${left}`,
        detail: sub.cancelAtPeriodEnd
          ? `Deneme ${formatDay(sub.trialEnd)} tarihinde bitiyor; ücret çekilmeyecek.`
          : `${formatDay(sub.trialEnd)} tarihinde ${money(sub.priceTry) ?? "paket ücreti"} çekilecek.`,
        badge: `Deneme · ${left.replace(" kaldı", "")}`,
        cta: manage,
      }
    }
    if (sub.status === "past_due") {
      return {
        title: "Ödemen alınamadı",
        detail: sub.currentPeriodEnd ? `Kartını güncelle; erişimin ${formatDay(sub.currentPeriodEnd)} tarihine kadar açık.` : "Kartını güncelle.",
        badge: "Ödeme bekliyor",
        cta: manage,
      }
    }
    return {
      title: `${PLAN_NAME[sub.plan] ?? "Paket"} aboneliğin açık`,
      detail: !sub.currentPeriodEnd
        ? null
        : sub.cancelAtPeriodEnd
          ? `İptal ettin; erişimin ${formatDay(sub.currentPeriodEnd)} tarihine kadar açık.`
          : `Sonraki ödeme ${formatDay(sub.currentPeriodEnd)}${sub.priceTry !== null ? ` · ${money(sub.priceTry)}` : ""}`,
      badge: "Abone",
      cta: manage,
    }
  }
  const q = status.quota
  if (!q) return { title: "Ücretsiz paket", detail: null, badge: "Ücretsiz", cta: "Paketleri gör" }
  const analyses = Math.max(0, q.analyses.limit - q.analyses.used)
  const adaptations = Math.max(0, q.adaptations.limit - q.adaptations.used)
  return {
    title: `Bu ay ${analyses} analiz ve ${adaptations} uyarlama hakkın kaldı`,
    detail: `${formatDay(q.resetsAt)} tarihinde yenilenir.`,
    badge: "Ücretsiz",
    cta: "Paketleri gör",
  }
}

/** Uyarla düğmesinin altında: basmadan önce neyin harcanacağı görünsün. */
export function adaptHint(status: BillingStatus): string | null {
  if (status.unlimited) return null
  if (status.access) return status.usedLast24h >= status.dailyCap ? `Son 24 saatteki ${status.dailyCap} uyarlama sınırına ulaştın.` : null
  if (!status.quota) return null
  return status.quota.adaptations.used < status.quota.adaptations.limit
    ? "Bu uyarlama bu ayki ücretsiz hakkını kullanır."
    : "Bu ayki ücretsiz uyarlamanı kullandın; devam etmek için abonelik gerekiyor."
}

/** Analiz formunun altında, yalnız ücretsiz kullanıcıda. */
/** Ücretsiz kullanıcının bu ayki analizleri bitti mi: gönder düğmesi yerine kilit kartı. */
export function analysisQuotaReached(status: BillingStatus): boolean {
  if (status.unlimited || status.access || !status.quota) return false
  return status.quota.analyses.used >= status.quota.analyses.limit
}

export function analysisNote(status: BillingStatus): string | null {
  if (status.unlimited || status.access || !status.quota) return null
  return `Bu ay ${status.quota.analyses.used}/${status.quota.analyses.limit} analiz · ${formatDay(status.quota.resetsAt)} tarihinde yenilenir`
}
