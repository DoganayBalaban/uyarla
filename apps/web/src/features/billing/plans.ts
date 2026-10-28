/**
 * Abonelik paketleri (DOG-158, K-107). Otomatik yenileme; 7 günlük deneme
 * Polar ürününde tanımlı. Ürün kimlikleri ve gösterim fiyatları
 * yapılandırmada; çekilen tutar Polar'dan.
 */
export type PlanKey = "month" | "quarter"

export const PLAN_MONTHS: Record<PlanKey, number> = { month: 1, quarter: 3 }

const ORDER: PlanKey[] = ["month", "quarter"]
const PRODUCT_ENV: Record<PlanKey, string> = { month: "POLAR_PRODUCT_MONTH", quarter: "POLAR_PRODUCT_QUARTER" }

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (ORDER as string[]).includes(value)
}

export interface PlanOffer {
  key: PlanKey
  months: number
  productId: string
  /** Fatura dönemi başına TL; ödeme sayfasındaki tutar Polar'dan. */
  priceTry: number | null
}

/** Ürün kimliği tanımlı paketler; `PLAN_PRICES_TRY` "month:299, quarter:599". */
export function plansFromEnv(env: Record<string, string | undefined>): PlanOffer[] {
  const prices = new Map(
    (env.PLAN_PRICES_TRY ?? "")
      .split(",")
      .map((pair) => pair.split(":").map((p) => p.trim()))
      .filter(([key, price]) => key && price && Number.isFinite(Number(price)))
      .map(([key, price]) => [key!, Number(price)]),
  )
  return ORDER.flatMap((key) => {
    const productId = env[PRODUCT_ENV[key]]?.trim()
    return productId ? [{ key, months: PLAN_MONTHS[key], productId, priceTry: prices.get(key) ?? null }] : []
  })
}

/** Aylık karşılığı, tam liraya yuvarlanmış (599/3 → 200). */
export function monthlyPrice(plan: PlanOffer): number | null {
  return plan.priceTry === null ? null : Math.round(plan.priceTry / plan.months)
}

/** 3 Ay'ın 1 Ay'a göre tasarrufu, yüzde; ikisinin de fiyatı yoksa null. */
export function savingsPercent(plans: PlanOffer[]): number | null {
  const month = plans.find((p) => p.key === "month")
  const quarter = plans.find((p) => p.key === "quarter")
  if (!month?.priceTry || !quarter?.priceTry) return null
  return Math.round((1 - quarter.priceTry / quarter.months / month.priceTry) * 100)
}

/** Karşılaştırma tablosunun satırları (spec §3); 1 Ay ve 3 Ay aynı. */
export const FEATURE_ROWS = [
  { label: "İlan analizi ve uyum skoru", free: "Ayda 5", paid: "Sınırsız" },
  { label: "CV uyarlama (ön yazı ve PDF/DOCX dahil)", free: "Ayda 1", paid: "Sınırsız (24 saatte 30)" },
  { label: "Mülakat hazırlık paketi", free: false, paid: true },
  { label: "Yazılı mülakat pratiği", free: false, paid: true },
  { label: "Başvuru formu yanıtları", free: false, paid: true },
  { label: "LinkedIn hakkında ve deneyim yazımı", free: false, paid: true },
  { label: "LinkedIn teşhisi ve başlık önerileri", free: true, paid: true },
  { label: "Başvuru panosu, takip mesajı ve teşekkür notu", free: true, paid: true },
  { label: "İş arama bağlantıları", free: true, paid: true },
  { label: "CV kütüphanesi, hatırlatmalar, Chrome eklentisi", free: true, paid: true },
] as const satisfies ReadonlyArray<{ label: string; free: string | boolean; paid: string | boolean }>

/** Tanıtım sayfasının kısa listesi. */
export const SUBSCRIPTION_FEATURES = [
  "Sınırsız analiz ve CV uyarlama",
  "Her ilana özel ön yazı, PDF ya da DOCX",
  "Mülakat hazırlık paketi ve yazılı pratik",
  "LinkedIn hakkında ve deneyim yazımı",
] as const
