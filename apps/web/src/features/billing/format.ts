import type { BillingStatus } from "@/features/billing/api"
import type { PlanKey, PlanOffer } from "@/features/billing/plans"

export const PLAN_LABEL: Record<PlanKey, string> = { week: "1 hafta", month: "1 ay", quarter: "3 ay" }

export function formatPassEnd(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(
    new Date(iso),
  )
}

/** Paketleri karşılaştırmak için günlük fiyat; fiyat yoksa null. */
export function perDay(priceTry: number | null, days: number): string | null {
  if (priceTry === null) return null
  return `${(priceTry / days).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL/gün`
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

/**
 * Kalan haklar (DOG-81): Hesabım, paket ekranı ve üst menü aynı metni
 * kullanıyor. Günlük sınır kayan 24 saat; "yarın" denmiyor.
 */
export function accessSummary(status: BillingStatus, now: Date): AccessSummary {
  if (status.passEndsAt) {
    const left = timeLeft(status.passEndsAt, now)
    const dailyLeft = Math.max(0, status.dailyCap - status.usedLast24h)
    const daily =
      dailyLeft === 0
        ? `Son 24 saatteki ${status.dailyCap} uyarlama sınırına ulaştın; en eski uyarlaman 24 saati doldurunca yeniden açılır.`
        : `Son 24 saatte ${dailyLeft} uyarlama hakkın kaldı (sınır ${status.dailyCap}).`
    return {
      title: `Erişimin ${formatPassEnd(status.passEndsAt)} tarihine kadar açık`,
      detail: `${left} · ${daily}`,
      badge: left,
      cta: "Süreyi uzat",
    }
  }
  if (status.freeLeft > 0) {
    return {
      title: `${status.freeLeft} ücretsiz uyarlama hakkın var`,
      detail: "Skor her zaman ücretsiz. Daha fazla uyarlama için bir paket seçebilirsin.",
      badge: `${status.freeLeft} ücretsiz hak`,
      cta: "Paketleri gör",
    }
  }
  return {
    title: "Ücretsiz uyarlama hakkını kullandın",
    detail: "Skor her zaman ücretsiz. Uyarlamaya devam etmek için bir erişim dönemi seç.",
    badge: "Paket al",
    cta: "Paket al",
  }
}

/** Uyarla düğmesinin altında: basmadan önce neyin harcanacağı görünsün. */
export function adaptHint(status: BillingStatus): string | null {
  if (status.passEndsAt) {
    return status.usedLast24h >= status.dailyCap
      ? `Son 24 saatteki ${status.dailyCap} uyarlama sınırına ulaştın.`
      : null
  }
  return status.freeLeft > 0
    ? "Bu uyarlama ücretsiz hakkını kullanır."
    : "Ücretsiz hakkını kullandın; uyarlamak için bir paket gerekiyor."
}

/** Paket ekranındaki tek ödeme düğmesi. */
export function payLabel(plan: PlanOffer): string {
  return plan.priceTry !== null ? `${PLAN_LABEL[plan.key]} · ${plan.priceTry} TL öde` : `${PLAN_LABEL[plan.key]} öde`
}

/** Dönem açıkken alınan paket bitişin üstüne ekleniyor; ödemeden önce söylensin. */
export function stackNote(status: BillingStatus): string | null {
  return status.passEndsAt
    ? `Yeni paket, mevcut erişimin bittiğinde (${formatPassEnd(status.passEndsAt)}) başlar; süreler üst üste eklenir.`
    : null
}
