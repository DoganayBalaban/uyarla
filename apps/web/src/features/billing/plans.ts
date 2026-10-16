/**
 * Erişim dönemi paketleri (DOG-34). Tek seferlik; otomatik yenileme yok.
 * Ürün kimlikleri ve gösterim fiyatları yapılandırmada: fiyatlar K2'den sonra
 * Polar panelinde belirleniyor, ödeme sayfasındaki tutar Polar'dan geliyor.
 */
export type PlanKey = "week" | "month" | "quarter"

export const PLAN_DAYS: Record<PlanKey, number> = { week: 7, month: 30, quarter: 90 }

const ORDER: PlanKey[] = ["week", "month", "quarter"]
const PRODUCT_ENV: Record<PlanKey, string> = {
  week: "POLAR_PRODUCT_WEEK",
  month: "POLAR_PRODUCT_MONTH",
  quarter: "POLAR_PRODUCT_QUARTER",
}

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (ORDER as string[]).includes(value)
}

export interface PlanOffer {
  key: PlanKey
  days: number
  productId: string
  /** Paket ekranında gösterilen TL fiyat; ödeme sayfasındaki tutar Polar'dan. */
  priceTry: number | null
}

/** Ürün kimliği tanımlı paketler; `PLAN_PRICES_TRY` "week:149, month:349". */
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
    return productId ? [{ key, days: PLAN_DAYS[key], productId, priceTry: prices.get(key) ?? null }] : []
  })
}
