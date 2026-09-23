import { ANALYZE_QUEUE, type AnalyzeJobData } from "@uyarla/worker/queue"
import { Queue } from "bullmq"
import IORedis from "ioredis"

const globalForQueue = globalThis as unknown as {
  analyzeQueue?: Queue<AnalyzeJobData, string>
}

/**
 * Kuyruğun üretici tarafı. Next geliştirme modunda modülleri yeniden
 * yüklediği için global'de saklanıyor; aksi hâlde her yeniden yüklemede
 * yeni bir Redis bağlantısı açılır ve bağlantılar birikir.
 */
export const analyzeQueue =
  globalForQueue.analyzeQueue ??
  new Queue<AnalyzeJobData, string>(ANALYZE_QUEUE, {
    connection: new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    }),
  })

if (process.env.NODE_ENV !== "production") globalForQueue.analyzeQueue = analyzeQueue
