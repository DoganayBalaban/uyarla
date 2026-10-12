import * as Sentry from "@sentry/node"
import { scrubErrorEvent } from "@uyarla/core/observability/scrub"
import { UnrecoverableError } from "bullmq"

/**
 * Worker hata izleme (DOG-62). `SENTRY_DSN` yoksa hiçbir şey başlamıyor.
 * Web ile aynı kişisel veri kuralları: toplama kapalı, olaylar temizleniyor.
 */
export function initErrorTracking(): void {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.NODE_ENV,
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0,
    beforeSend: (event) => scrubErrorEvent(event),
  })
}

interface JobLike {
  attemptsMade: number
  opts: { attempts?: number }
}

/**
 * Başarısız iş bildirilmeli mi?
 *
 * Kalıcı hatalar (taranmış PDF, okunamayan dosya) beklenen kullanıcı
 * hataları; ekrana zaten anlaşılır mesajla çıkıyorlar ve izlemeyi
 * boğarlar. Tekrar denenecek bir deneme de henüz hata değil. Bildirilen:
 * denemeleri tükenmiş beklenmedik hata.
 */
export function shouldReport(job: JobLike | undefined, error: Error): boolean {
  if (error instanceof UnrecoverableError) return false
  if (!job) return true
  return job.attemptsMade >= (job.opts.attempts ?? 1)
}

/** İş verisi (kullanıcı kimliği, dosya yolu) olaya eklenmiyor; yalnızca kuyruk adı. */
export function reportJobFailure(queue: string, job: JobLike | undefined, error: Error): void {
  if (!shouldReport(job, error)) return
  Sentry.captureException(error, { tags: { queue } })
}
