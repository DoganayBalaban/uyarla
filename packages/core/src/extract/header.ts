import { normalizeText } from "../normalize/turkish.js"

export interface ResumeHeader {
  fullName: string | null
  /** Unvan, konum ve bağlantılar; belgede adın altındaki gri satır. */
  headline: string | null
}

/** "ÖZGEÇMİŞ", "CV", "RESUME" — belge başlığı, kişi adı değil. */
const BELGE_BASLIGI = /^(ozgecmis|cv|curriculum vitae|resume|resume\/cv|özgeçmiş)$/

/** Bir ad bu uzunluğu aşmaz; aşıyorsa cümledir. */
const MAX_AD_UZUNLUGU = 50

/** Başlık satırına en çok bu kadar parça giriyor. */
const MAX_BASLIK_PARCASI = 3

/**
 * Bir satırın kişi adı olamayacağını söyleyen işaretler.
 *
 * Yanlış ad, CV'nin en görünür yerinde yanlış bilgi demek. Şüphedeyken ad
 * yazmamak, yanlış ad yazmaktan iyi — bu yüzden kural dışlayıcı.
 */
function adOlamaz(satir: string): boolean {
  return (
    satir.length > MAX_AD_UZUNLUGU ||
    satir.includes("@") ||
    /https?:|www\.|\.com|\.dev|\.io|github|linkedin/i.test(satir) ||
    // Telefon, posta kodu, tarih: adlar rakam taşımaz.
    /\d/.test(satir)
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
  const satirlar = headerBlock
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !BELGE_BASLIGI.test(normalizeText(s)))

  if (satirlar.length === 0) return { fullName: null, headline: null }

  const adAdayi = satirlar[0]!
  const ad = adOlamaz(adAdayi) ? null : adAdayi

  // Ad kabul edilmediyse o satır da başlık satırına giriyor: bilgi atmak
  // yerine doğru yere koyuyoruz.
  const kalanlar = ad ? satirlar.slice(1) : satirlar

  return {
    fullName: ad,
    headline: kalanlar.length > 0 ? kalanlar.slice(0, MAX_BASLIK_PARCASI).join(" · ") : null,
  }
}
