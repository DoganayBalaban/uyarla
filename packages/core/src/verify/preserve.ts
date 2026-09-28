import { containsKeyword } from "../normalize/turkish.js"
import type { JobPostingData } from "../schemas/job.js"

/**
 * Yeniden yazımın kaynaktaki bilgiyi koruyup korumadığı (K-38).
 *
 * Uydurma kontrolleri yazıma EKLENENE bakıyor; bu kontrol KAYBOLANA bakıyor.
 * Uçtan uca testte model "sayfa yüklenme süresini %40 azalttım"ı
 * "web performansı %40 azalttım"a çevirdi: sayı korunduğu için sayı
 * kontrolü geçti, ama anlam tersine döndü ve özgün ifade silindi. Özet
 * yazımı da "4 yıllık deneyime sahip frontend geliştiriciyim" cümlesini
 * düşürdü.
 *
 * Üç koşul:
 *   1. Terim uyumunun dayanağı yazımda duruyor: terim ifadenin yanına
 *      eklenir, yerine geçmez.
 *   2. Kaynakta geçen ilan kavramları yazımda da geçiyor (birikmiş işler #10).
 *   3. Kaynaktaki sayılar yazımda da geçiyor.
 */
export function preservesSource(input: {
  rewritten: string
  source: string
  posting: JobPostingData
  /** Terim uyumlarının dayanakları. */
  bases?: readonly string[]
}): { ok: true } | { ok: false; reason: string } {
  for (const dayanak of input.bases ?? []) {
    if (!containsKeyword(input.rewritten, dayanak)) {
      return { ok: false, reason: `dayanak kayboldu: ${dayanak}` }
    }
  }

  for (const kavram of input.posting.requirements.flatMap((r) => r.concepts)) {
    const uyeler = [kavram.term, ...kavram.synonyms]
    const kaynakta = uyeler.some((t) => containsKeyword(input.source, t))
    if (kaynakta && !uyeler.some((t) => containsKeyword(input.rewritten, t))) {
      return { ok: false, reason: `ilan kavramı kayboldu: ${kavram.term}` }
    }
  }

  const yazimSayilari = new Set(sayilar(input.rewritten))
  for (const sayi of sayilar(input.source)) {
    if (!yazimSayilari.has(sayi)) return { ok: false, reason: `sayı kayboldu: ${sayi}` }
  }

  return { ok: true }
}

function sayilar(metin: string): string[] {
  return metin.match(/\d+(?:[.,]\d+)*/g) ?? []
}
