import {
  LmStudioProvider,
  OpenAiCompatibleEmbeddingProvider,
  PermanentError,
  embeddingConfigFromEnv,
  llmConfigFromEnv,
} from "@uyarla/core"
import { Worker, UnrecoverableError } from "bullmq"
import IORedis from "ioredis"
import { runAdaptation } from "./adapt-pipeline.js"
import { ADAPT_QUEUE, type AdaptJobData } from "./adapt-queue.js"
import { prismaAdaptationStore } from "./adapt-store.js"
import { runAnalysis } from "./pipeline.js"
import { ANALYZE_QUEUE, type AnalyzeJobData } from "./queue.js"
import { prismaStore } from "./store.js"

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
})

const llmConfig = llmConfigFromEnv()
const llm = new LmStudioProvider(llmConfig)
const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())

const worker = new Worker<AnalyzeJobData, string>(
  ANALYZE_QUEUE,
  async (job) => {
    try {
      return await runAnalysis(
        {
          llm,
          embedding,
          store: prismaStore,
          modelId: llmConfig.model,
          onProgress: (stage) => void job.updateProgress({ stage }),
        },
        { resumeId: job.data.resumeId, jobPostingId: job.data.jobPostingId },
      )
    } catch (error) {
      // Kalıcı hatada tekrar denemek anlamsız: girdi hatalı, ikinci deneme de
      // aynı sonucu verir ve kullanıcıyı boşuna bekletir (spec §11).
      if (error instanceof PermanentError) {
        throw new UnrecoverableError(error.message)
      }
      throw error
    }
  },
  { connection, concurrency: 2 },
)

worker.on("failed", (job, error) => {
  console.error(`[analyze] iş başarısız: ${job?.id ?? "?"} — ${error.message}`)
})

worker.on("completed", (job, analysisId) => {
  console.log(`[analyze] tamamlandı: iş ${job.id} → analiz ${analysisId}`)
})

const adaptWorker = new Worker<AdaptJobData, void>(
  ADAPT_QUEUE,
  async (job) => {
    try {
      await runAdaptation(
        {
          llm,
          embedding,
          store: prismaAdaptationStore,
          onProgress: (stage) => void job.updateProgress({ stage }),
        },
        { adaptationId: job.data.adaptationId },
      )
    } catch (error) {
      if (error instanceof PermanentError) throw new UnrecoverableError(error.message)
      throw error
    }
  },
  // Eşzamanlılık 1: bir uyarlama zaten madde başına paralel çağrı yapıyor,
  // ikinci bir katman yerel modeli sıraya sokmaktan başka işe yaramaz (K-16).
  { connection, concurrency: 1 },
)

adaptWorker.on("failed", (job, error) => {
  console.error(`[adapt] iş başarısız: ${job?.id ?? "?"} — ${error.message}`)
})

adaptWorker.on("completed", (job) => {
  console.log(`[adapt] tamamlandı: uyarlama ${job.data.adaptationId}`)
})

console.log(
  `[worker] ${ANALYZE_QUEUE} ve ${ADAPT_QUEUE} kuyrukları dinleniyor · model: ${llmConfig.model}`,
)
