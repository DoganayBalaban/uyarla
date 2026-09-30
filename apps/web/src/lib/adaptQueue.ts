import { ADAPT_QUEUE, type AdaptJobData } from "@uyarla/worker/adapt-queue"
import { Queue } from "bullmq"
import { redis } from "./redis"

const globalForQueue = globalThis as unknown as { adaptQueue?: Queue<AdaptJobData, void> }

/**
 * Next geliştirme modunda modülleri yeniden yüklüyor; global'de saklanmazsa
 * her yeniden yüklemede yeni bir Redis bağlantısı açılır (bkz. lib/queue.ts).
 */
export const adaptQueue =
  globalForQueue.adaptQueue ??
  new Queue<AdaptJobData, void>(ADAPT_QUEUE, { connection: redis })

if (process.env.NODE_ENV !== "production") globalForQueue.adaptQueue = adaptQueue
