import { normalizeText } from "../normalize/turkish.js"

export interface ResumeHeader {
  fullName: string | null
  /** Unvan, konum ve bağlantılar; belgede adın altındaki gri satır. */
  headline: string | null
}

/** "ÖZGEÇMİŞ", "CV", "RESUME" — belge başlığı, kişi adı değil. */
const DOCUMENT_TITLE = /^(ozgecmis|cv|curriculum vitae|resume|resume\/cv|özgeçmiş)$/

/** Bir ad bu uzunluğu aşmaz; aşıyorsa cümledir. */
const MAX_NAME_LENGTH = 50

/** Başlık satırına en çok bu kadar parça giriyor. */
const MAX_HEADING_PARTS = 3

/**
 * Bir satırın kişi adı olamayacağını söyleyen işaretler.
 *
 * Yanlış ad, CV'nin en görünür yerinde yanlış bilgi demek. Şüphedeyken ad
 * yazmamak, yanlış ad yazmaktan iyi — bu yüzden kural dışlayıcı.
 */
function cannotBeName(lineItem: string): boolean {
  return (
    lineItem.length > MAX_NAME_LENGTH ||
    lineItem.includes("@") ||
    /https?:|www\.|\.com|\.dev|\.io|github|linkedin/i.test(lineItem) ||
    // Telefon, posta kodu, tarih: adlar rakam taşımaz.
    /\d/.test(lineItem)
  )
}

/**
 * CV'nin başlık bloğundan ad ve iletişim satırını çıkarır.
 *
 * Kodda yapılıyor, LLM'e sorulmuyor. Sprint 1'in dört kez öğrenilen dersi
 * (K-11, K-18, K-19, K-22): modelden yorum istendiğinde hatalar sessiz
 * oluyor ve şema doğrulamasından geçiyor. "Hangi satır ad" sorusu ise
 * deterministik kurallarla cevaplanabiliyor ve kodda kırıldığında testler
 * kırmızıya dönüyor.
 *
 * Sprint 1'de bu alanlar hiç doldurulmuyordu çünkü skor onları
 * kullanmıyordu; Sprint 2'de indirilen belgenin başlığı oluyorlar.
 */
export function parseHeader(headerBlock: string): ResumeHeader {
  const lineItems = headerBlock
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !DOCUMENT_TITLE.test(normalizeText(s)))

  if (lineItems.length === 0) return { fullName: null, headline: null }

  const nameCandidate = lineItems[0]!
  const name = cannotBeName(nameCandidate) ? null : nameCandidate

  // Ad kabul edilmediyse o satır da başlık satırına giriyor: bilgi atmak
  // yerine doğru yere koyuyoruz.
  const remaining = name ? lineItems.slice(1) : lineItems

  return {
    fullName: name,
    headline: remaining.length > 0 ? remaining.slice(0, MAX_HEADING_PARTS).join(" · ") : null,
  }
}
