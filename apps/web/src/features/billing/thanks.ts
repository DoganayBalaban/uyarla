import type { BillingStatus } from "@/features/billing/api"

/**
 * Ödeme bildirimi ile oturumun açılması arasındaki saat farkına pay. İki
 * zaman da sunucuda üretiliyor (Vercel); fark milisaniyeler, ödemenin kendisi
 * saniyeler sürüyor.
 */
const CLOCK_SLACK_MS = 5_000

/**
 * Teşekkür sayfasının beklediği abonelik geldi mi (DOG-80, DOG-158). `since`:
 * ödeme oturumunun açıldığı an (dönüş adresindeki `odeme`); yalnızca bu andan
 * sonra açılan abonelik sayılıyor. `since` yoksa (eski bağlantı) erişim
 * veren herhangi bir abonelik.
 */
export function paymentArrived(status: BillingStatus, since: number | null): boolean {
  if (!status.access || !status.subscription) return false
  if (since === null) return true
  return Date.parse(status.subscription.createdAt) >= since - CLOCK_SLACK_MS
}

/** Bundan sonra "birkaç dakika" uyarısı ve seyrek yoklama. */
export const SLOW_AFTER_MS = 60_000
/** Bundan sonra yoklama duruyor; kullanıcı destek adresine yönlendiriliyor. */
export const GIVE_UP_AFTER_MS = 10 * 60_000

/** Yoklama aralığı: ilk dakika 2 sn, sonra 10 sn, on dakikadan sonra dur. */
export function pollInterval(elapsedMs: number): number | false {
  if (elapsedMs >= GIVE_UP_AFTER_MS) return false
  return elapsedMs >= SLOW_AFTER_MS ? 10_000 : 2_000
}

/** Dönüş adresindeki `odeme` değeri; geçersizse null. */
export function parseSince(raw: string | undefined): number | null {
  if (!raw || !/^\d{10,16}$/.test(raw)) return null
  return Number(raw)
}
