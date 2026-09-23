import {
  LmStudioProvider,
  OpenAiCompatibleEmbeddingProvider,
  PermanentError,
  embeddingConfigFromEnv,
  llmConfigFromEnv,
} from "@uyarla/core"
import { Worker, UnrecoverableError } from "bullmq"
import IORedis from "ioredis"
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

console.log(
  `[worker] ${ANALYZE_QUEUE} kuyruğu dinleniyor · model: ${llmConfig.model}`,
)
