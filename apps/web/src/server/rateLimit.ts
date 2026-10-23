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
  // Veri indirme bütün CV dosyalarını depodan okuyor (DOG-63); saatte birkaç kez yeter.
  dataExport: { limit: 5, windowSeconds: 3600 },
  // Yazarken canlı skor (DOG-92): LLM yok, yeni metin için bir gömme çağrısı.
  // Yazmaya ara verince bir istek; saatte birkaç uzun düzenleme yeter.
  scorePreview: { limit: 150, windowSeconds: 3600 },
  // LinkedIn profil denetimi (DOG-157): günde 5 tarama, yapay zekâ maliyetinin üst sınırı.
  linkedinAudit: { limit: 5, windowSeconds: 86400 },
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
      "rate_limited",
    )
  }
}
