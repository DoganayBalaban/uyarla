import { AuthError } from "@/server/authz"
import { redis } from "@/server/redis"

export interface RateLimitRule {
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
  anonUser: { limit: 3, windowSeconds: 3600 },
  registered: { limit: 10, windowSeconds: 3600 },
} satisfies Record<string, RateLimitRule>

/**
 * Sabit pencereli sayaç.
 *
 * Kayan pencere daha adil olurdu ama Redis'te sıralı küme gerektiriyor;
 * pahalı uçları korumak için sabit pencere yeterli ve okunması kolay.
 */
export const redisStore: RateLimitStore = {
  async incr(key, windowSeconds) {
    const val = await redis.incr(key)
    // Yalnızca ilk artışta süre veriliyor; her çağrıda vermek pencereyi
    // sürekli ileri iter ve limit hiç sıfırlanmaz.
    if (val === 1) await redis.expire(key, windowSeconds)
    return val
  },
}

/** Limit aşılırsa 429'luk AuthError fırlatır. */
export async function enforceRateLimit(
  store: RateLimitStore,
  key: string,
  rule: RateLimitRule,
): Promise<void> {
  // Pencere numarası anahtara giriyor: süre dolduğunda anahtar da değişiyor
  // ve sayaç kendiliğinden sıfırlanıyor. Katmazsak anahtar sonsuza kadar aynı
  // kalır ve kullanıcı kalıcı olarak kilitlenir.
  const window = Math.floor(Date.now() / 1000 / rule.windowSeconds)
  const fullKey = `hiz:${key}:${window}`

  const count = await store.incr(fullKey, rule.windowSeconds)
  if (count > rule.limit) {
    throw new AuthError(
      "Çok hızlı gidiyoruz. Bir saat sonra tekrar dener misin?",
      429,
      "limit_asildi",
    )
  }
}
