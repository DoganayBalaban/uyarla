import { scrubErrorEvent } from "@uyarla/core/observability/scrub"

/**
 * Tarayıcı tarafı hata izleme (DOG-62), tembel yüklenen.
 *
 * Sentry'nin tarayıcı paketi her sayfanın ilk yükünü 102 kB'tan 187 kB'a
 * çıkarıyordu (ölçüldü, 12 Ekim 2026). Bu yüzden SDK yalnızca DSN tanımlıysa
 * ve sayfa açıldıktan sonra ayrı bir parça olarak yükleniyor. Yükleme
 * bitmeden olan hatalar kaçabilir; ilk yükü %83 büyütmekten iyi bir bedel.
 *
 * DSN tarayıcıya gittiği için `NEXT_PUBLIC_` ön ekli; Sentry DSN'i gizli bir
 * anahtar değil, yalnızca olay gönderme adresi.
 */
const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

let loading: Promise<typeof import("@sentry/nextjs")> | null = null

function sentry(): Promise<typeof import("@sentry/nextjs")> | null {
  if (!DSN) return null
  loading ??= import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: DSN,
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
      tracesSampleRate: 0,
      // Oturum kaydı (replay) ekran görüntüsü topluyor; CV metni ekranda.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      beforeSend: (event) => scrubErrorEvent(event),
    })
    return Sentry
  })
  return loading
}

/** Yakalanmamış hataları dinlemeye başlar; DSN yoksa hiçbir şey yapmaz. */
export function startClientErrorTracking(): void {
  void sentry()
}

/** Hata sınırının yuttuğu hatayı bildirir. */
export function reportClientError(error: unknown): void {
  void sentry()?.then((Sentry) => Sentry.captureException(error))
}
