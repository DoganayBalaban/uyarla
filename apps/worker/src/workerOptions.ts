import type { ConnectionOptions, WorkerOptions } from "bullmq"

/**
 * İş kilidi süresi (DOG-65).
 *
 * BullMQ kilidi varsayılan 30 sn tutuyor ve iş sürerken yeniliyor. Yerel
 * modelle olay döngüsü dakikalarca bloklanınca yenileme yetişmedi
 * ("could not renew lock"), iş takılmış sayılıp ikinci kez işlendi ve LLM
 * maliyeti ikiye katlandı. OpenAI ile iş saniyeler sürüyor, ama uzun bir
 * PDF ayrıştırma ya da yavaş bir API yanıtı yine olay döngüsünü tutabilir.
 *
 * Bedeli: worker gerçekten çökerse takılan iş en geç 2 dakika sonra yeniden
 * alınıyor (30 sn yerine).
 */
export const LOCK_DURATION_MS = 120_000

export function workerOptions(connection: ConnectionOptions, concurrency: number): WorkerOptions {
  return { connection, concurrency, lockDuration: LOCK_DURATION_MS }
}
