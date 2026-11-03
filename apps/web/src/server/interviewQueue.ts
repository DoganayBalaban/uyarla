import { INTERVIEW_QUEUE, type SimulationJobData } from "@uyarla/worker/adapt-queue"
import { Queue } from "bullmq"
import { redis } from "@/server/redis"

const globalForQueue = globalThis as unknown as { interviewQueue?: Queue<SimulationJobData, void> }

/** Mülakat simülasyonu kuyruğu (DOG-172); bkz. src/server/queue.ts. */
export const interviewQueue =
  globalForQueue.interviewQueue ?? new Queue<SimulationJobData, void>(INTERVIEW_QUEUE, { connection: redis })

if (process.env.NODE_ENV !== "production") globalForQueue.interviewQueue = interviewQueue
