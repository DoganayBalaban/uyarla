import type { PlanKey } from "@/features/billing/plans"

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

/** Paket ekranının giriş cümlesi; kullanıcının durumuna göre. */
export function plansIntro(status: { passEndsAt: string | null; freeUsed: boolean } | undefined): string {
  if (status?.passEndsAt) {
    return `Erişimin ${formatPassEnd(status.passEndsAt)} tarihine kadar açık. Yeni paket bu tarihin üstüne eklenir.`
  }
  const lead = status?.freeUsed
    ? "Ücretsiz uyarlama hakkını kullandın."
    : "Bir ücretsiz uyarlama hakkın var; daha fazlası için bir paket seçebilirsin."
  return `${lead} Bir erişim dönemi seç; süre boyunca istediğin kadar CV uyarla ve ön yazı oluştur. Otomatik yenileme yok.`
}
