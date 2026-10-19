import type { BillingStatus } from "@/features/billing/api"

/**
 * Ödeme bildirimi ile oturumun açılması arasındaki saat farkına pay. İki
 * zaman da sunucuda üretiliyor (Vercel); fark milisaniyeler, ödemenin kendisi
 * saniyeler sürüyor.
 */
const CLOCK_SLACK_MS = 5_000

/**
 * Teşekkür sayfasının beklediği ödeme geldi mi (DOG-80). `since`: ödeme
 * oturumunun açıldığı an (dönüş adresindeki `odeme`). Önceden aktif bir dönem
 * varsa bitiş tarihi zaten dolu; yalnızca bu andan sonra açılan dönem sayılıyor.
 * `since` yoksa (eski bağlantı) eski davranış: herhangi bir aktif dönem.
 */
export function paymentArrived(status: BillingStatus, since: number | null): boolean {
  if (!status.passEndsAt) return false
  if (since === null) return true
  if (!status.lastPassAt) return false
  return Date.parse(status.lastPassAt) >= since - CLOCK_SLACK_MS
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
