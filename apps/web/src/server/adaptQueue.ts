import { ADAPT_QUEUE, type AdaptJobData, type ContributionJobData } from "@uyarla/worker/adapt-queue"
import { Queue } from "bullmq"
import { redis } from "@/server/redis"

/** Uyarlama ve ön yazı { adaptationId }, katkı ayrıca contributionId taşıyor (DOG-94). */
type AdaptQueueData = AdaptJobData | ContributionJobData

const globalForQueue = globalThis as unknown as { adaptQueue?: Queue<AdaptQueueData, void> }

/**
 * Next geliştirme modunda modülleri yeniden yüklüyor; global'de saklanmazsa
 * her yeniden yüklemede yeni bir Redis bağlantısı açılır (bkz. src/server/queue.ts).
 */
export const adaptQueue =
  globalForQueue.adaptQueue ??
  new Queue<AdaptQueueData, void>(ADAPT_QUEUE, { connection: redis })

if (process.env.NODE_ENV !== "production") globalForQueue.adaptQueue = adaptQueue
