import { AuthError } from "./authz"
import { redis } from "./redis"

export interface RateLimitKural {
  limit: number
  windowSeconds: number
}

/** Test edilebilirlik için daraltılmış depo yüzeyi. */
export interface RateLimitStore {
  /** Anahtarı artırır ve pencere içindeki yeni değeri döndürür. */
  incr(key: string, windowSeconds: number): Promise<number>
}

/**
 * Başlangıç değerleri — bunlar TAHMİN.
 *
 * Gerçek rakam kullanım verisiyle ayarlanacak (spec §9). Sprint 2'deki eşik
 * taramasında olduğu gibi: karar ölçümle verilir, sezgiyle değil.
 */
export const RATE_LIMITS = {
  anonim: { limit: 3, windowSeconds: 3600 },
  kayitli: { limit: 10, windowSeconds: 3600 },
} satisfies Record<string, RateLimitKural>

/**
 * Sabit pencereli sayaç.
 *
 * Kayan pencere daha adil olurdu ama Redis'te sıralı küme gerektiriyor;
 * pahalı uçları korumak için sabit pencere yeterli ve okunması kolay.
 */
export const redisStore: RateLimitStore = {
  async incr(key, windowSeconds) {
    const deger = await redis.incr(key)
    // Yalnızca ilk artışta süre veriliyor; her çağrıda vermek pencereyi
    // sürekli ileri iter ve limit hiç sıfırlanmaz.
    if (deger === 1) await redis.expire(key, windowSeconds)
    return deger
  },
}

/** Limit aşılırsa 429'luk AuthError fırlatır. */
export async function enforceRateLimit(
  store: RateLimitStore,
  key: string,
  kural: RateLimitKural,
): Promise<void> {
  // Pencere numarası anahtara giriyor: süre dolduğunda anahtar da değişiyor
  // ve sayaç kendiliğinden sıfırlanıyor. Katmazsak anahtar sonsuza kadar aynı
  // kalır ve kullanıcı kalıcı olarak kilitlenir.
  const pencere = Math.floor(Date.now() / 1000 / kural.windowSeconds)
  const tamAnahtar = `hiz:${key}:${pencere}`

  const sayi = await store.incr(tamAnahtar, kural.windowSeconds)
  if (sayi > kural.limit) {
    throw new AuthError(
      "Çok hızlı gidiyoruz. Bir saat sonra tekrar dener misin?",
      429,
      "limit_asildi",
    )
  }
}
