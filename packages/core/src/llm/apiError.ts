import { PermanentError, TransientError } from "../errors.js"

/**
 * OpenAI uyumlu bir uçtan gelen hatayı tekrar denenebilir ya da kalıcı
 * olarak sınıflandırır.
 *
 * Yerel sunucuda (LM Studio, Ollama) hata neredeyse her zaman "erişilemedi"
 * demekti. Barındırılan API'de durum kodu anlam taşıyor: yanlış anahtar,
 * olmayan model ya da şemayı reddeden bir istek üç kez denense de aynı
 * sonucu verir ve kullanıcıyı boşuna bekletir (spec §11).
 *
 * SDK 429 ve 5xx'i zaten kendi içinde tekrar deniyor; buraya ulaşan 429
 * onun da vazgeçtiği bir oran sınırıdır, kuyruk geri çekilmeyle tekrar dener.
 * Tek istisna `insufficient_quota`: kota dolmuşsa beklemek çözmez.
 */
export function classifyApiError(cause: unknown, label: string, codePrefix: string): Error {
  const message = `${label} başarısız: ${(cause as Error)?.message ?? String(cause)}`
  const status = (cause as { status?: unknown })?.status
  const apiCode = (cause as { code?: unknown })?.code

  if (status === 429 && apiCode === "insufficient_quota") {
    return new PermanentError(message, `${codePrefix}_quota_exceeded`)
  }
  if (typeof status === "number" && status >= 400 && status < 500 && !RETRYABLE.has(status)) {
    return new PermanentError(message, `${codePrefix}_rejected`)
  }
  if (status === 429) return new TransientError(message, `${codePrefix}_rate_limited`)
  return new TransientError(message, `${codePrefix}_unreachable`)
}

/** Zaman aşımı, çakışma ve oran sınırı: beklemek işe yarayabilir. */
const RETRYABLE = new Set([408, 409, 429])
