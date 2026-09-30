/**
 * Başarısız bir analiz işinin kullanıcıya gösterilecek mesajı.
 *
 * Kalıcı hatalar (taranmış PDF, okunamayan dosya) worker'da kullanıcı diliyle
 * yazılıyor ve tek denemede düşüyor; onlar olduğu gibi gösterilir. Geçici
 * hatalar (model sunucusuna ulaşılamadı, zaman aşımı) bütün denemeleri
 * tüketiyor ve metinleri teknik: "LLM çağrısı başarısız: Connection error."
 * Uçtan uca testte bu metin doğrudan ekrana çıkıyordu (K-38).
 */
export const TRANSIENT_ERROR_MESSAGE =
  "Şu an yoğunuz ve analizini tamamlayamadık. Birkaç dakika sonra tekrar dener misin?"

export function analysisErrorMessage(job: {
  failedReason?: string | null
  attemptsMade: number
  opts: { attempts?: number }
}): string {
  const attempt = job.opts.attempts ?? 1
  const isPermanent = job.attemptsMade < attempt
  if (isPermanent && job.failedReason) return job.failedReason
  return TRANSIENT_ERROR_MESSAGE
}
