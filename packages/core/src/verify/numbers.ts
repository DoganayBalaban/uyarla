import type { VerificationIssue } from "../schemas/adaptation.js"

/** Tam sayılar ve ondalıklar; ondalık ayıracı virgül veya nokta olabilir. */
const NUMBER = /\d+(?:[.,]\d+)?/g

/**
 * Ondalık ayıracını tek biçime indirir. Model Türkçe "9,4"ü İngilizce
 * "9.4" diye yazabiliyor; bu yeniden ifadedir, uydurma değil.
 */
function withoutSeparators(num: string): string {
  return num.replace(",", ".")
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
  const sourceItems = new Set((source.match(NUMBER) ?? []).map(withoutSeparators))
  const newItems = [...new Set(rewritten.match(NUMBER) ?? [])]

  return newItems
    .filter((num) => !sourceItems.has(withoutSeparators(num)))
    .map((num) => ({
      kind: "number_mismatch" as const,
      detail: `Bu maddede "${num}" sayısı geçiyor ama senin yazdığın hâlinde yok.`,
    }))
}
