import type { VerificationIssue } from "../schemas/adaptation.js"

/** Tam sayılar ve ondalıklar; ondalık ayıracı virgül veya nokta olabilir. */
const SAYI = /\d+(?:[.,]\d+)?/g

/**
 * Ondalık ayıracını tek biçime indirir. Model Türkçe "9,4"ü İngilizce
 * "9.4" diye yazabiliyor; bu yeniden ifadedir, uydurma değil.
 */
function ayiracsiz(sayi: string): string {
  return sayi.replace(",", ".")
}

/**
 * Yeniden yazımdaki her sayının kaynakta da bulunup bulunmadığını kontrol
 * eder (spec §7.1).
 *
 * Yalnızca EKLENEN veya DEĞİŞEN sayılar uyarı üretir. Kaynaktaki bir sayıyı
 * düşürmek uydurma değildir — bilgi eksiltmek kullanıcının zaten gördüğü bir
 * değişiklik.
 */
export function checkNumbers(rewritten: string, source: string): VerificationIssue[] {
  const kaynaktakiler = new Set((source.match(SAYI) ?? []).map(ayiracsiz))
  const yenidekiler = [...new Set(rewritten.match(SAYI) ?? [])]

  return yenidekiler
    .filter((sayi) => !kaynaktakiler.has(ayiracsiz(sayi)))
    .map((sayi) => ({
      kind: "number_mismatch" as const,
      detail: `Bu maddede "${sayi}" sayısı geçiyor ama senin yazdığın hâlinde yok.`,
    }))
}
