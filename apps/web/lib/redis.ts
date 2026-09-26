import IORedis from "ioredis"

const globalForRedis = globalThis as unknown as { redis?: IORedis }

/**
 * Paylaşılan Redis bağlantısı.
 *
 * Kuyruklar ve hız limiti aynı bağlantıyı kullanıyor. Next geliştirme
 * modunda modülleri yeniden yüklediği için global'de saklanıyor; aksi hâlde
 * her yeniden yüklemede yeni bağlantı açılır ve birikirler.
 */
export const redis =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  })

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis
