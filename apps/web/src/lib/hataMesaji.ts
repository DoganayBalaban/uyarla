/**
 * Başarısız bir analiz işinin kullanıcıya gösterilecek mesajı.
 *
 * Kalıcı hatalar (taranmış PDF, okunamayan dosya) worker'da kullanıcı diliyle
 * yazılıyor ve tek denemede düşüyor; onlar olduğu gibi gösterilir. Geçici
 * hatalar (model sunucusuna ulaşılamadı, zaman aşımı) bütün denemeleri
 * tüketiyor ve metinleri teknik: "LLM çağrısı başarısız: Connection error."
 * Uçtan uca testte bu metin doğrudan ekrana çıkıyordu (K-38).
 */
export const GECICI_HATA_MESAJI =
  "Şu an yoğunuz ve analizini tamamlayamadık. Birkaç dakika sonra tekrar dener misin?"

export function analizHataMesaji(job: {
  failedReason?: string | null
  attemptsMade: number
  opts: { attempts?: number }
}): string {
  const deneme = job.opts.attempts ?? 1
  const kaliciMi = job.attemptsMade < deneme
  if (kaliciMi && job.failedReason) return job.failedReason
  return GECICI_HATA_MESAJI
}
