import * as Sentry from "@sentry/nextjs"
import { scrubErrorEvent } from "@uyarla/core/observability/scrub"

/**
 * Sunucu tarafı hata izleme (DOG-62). `SENTRY_DSN` yoksa hiçbir şey
 * başlamıyor: yerel geliştirme ve DSN girilmemiş ortamlar etkilenmiyor.
 *
 * Kişisel veri iki katmanda kapalı: `dataCollection` kullanıcı, çerez, başlık ve
 * gövde toplamıyor, `scrubErrorEvent` istek gövdesini ve mesajlardaki e-posta ve
 * telefonu siliyor. Performans izleme kapalı (`tracesSampleRate: 0`); şimdilik
 * yalnızca hatalar.
 */
export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Kullanıcı, çerez, başlık, gövde ve sorgu parametresi toplanmıyor (KVKK).
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: 0,
    beforeSend: (event) => scrubErrorEvent(event),
  })
}

/** Route ve sunucu bileşeni hatalarını yakalıyor; DSN yoksa SDK sessizce geçiyor. */
export const onRequestError = Sentry.captureRequestError
