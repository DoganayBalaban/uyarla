/**
 * CV çıktısının stili, tek yerde (CV biçimi, 9 Kasım 2026).
 *
 * PDF ve DOCX boşluklarını ayrı ayrı, elle tutuyordu; iki dosya zamanla
 * birbirinden ayrıştı ve aralıklar düzensiz kaldı. Değerler punto (pt):
 * PDF doğrudan kullanıyor, DOCX yarım punto (boyut) ve twip'e (aralık)
 * çeviriyor.
 *
 * Yazı tipi Carlito (PDF) / Calibri (DOCX): ikisi aynı ölçüde, aynı yerden
 * satır kırıyor.
 */
export const CV_STYLE = {
  margin: { side: 52, vertical: 46, compactVertical: 32 },
  color: { ink: "#111111", soft: "#4a4a4a", faint: "#8a8a8a", rule: "#c8c8c8" },
  size: { name: 22, title: 11.5, contact: 9.5, heading: 10, entry: 10.75, body: 10.25, meta: 9.5 },
  /** Gövde metninde satırlar arası ek boşluk. */
  lineGap: 1.6,
  space: {
    /** Ad ile unvan arası. */
    afterName: 1,
    /** Unvan ile iletişim satırı arası. */
    afterTitle: 3,
    /** Başlık bloğu ile özet arası. */
    afterHeader: 14,
    /** Bölüm başlığından önce. */
    section: 15,
    /** Bölüm çizgisinden sonra. */
    afterRule: 7,
    /** Aynı bölümdeki iki kayıt arası. */
    entry: 9,
    /** Kayıt başlığı ile ilk madde arası. */
    afterEntryHeader: 2.5,
    /** İki madde ya da satır arası. */
    bullet: 2.2,
  },
  /**
   * Bölüm başlığının harf aralığı. 0,6'nın üstünde metin katmanı harf harf
   * okunuyor ("D E N E Y İ M") ve ATS bölümü bulamıyor; pdf.test bunu ölçüyor.
   */
  headingTracking: 0.6,
  /** Madde iminin girintisi ve metnin başladığı yer. */
  bullet: { mark: 2, text: 13 },
  /** İletişim parçaları arasındaki ayraç. */
  contactSeparator: "  ·  ",
  /** Sıkı yerleşimde (tek sayfa planı, DOG-93) dikey aralıkların çarpanı. */
  compactSpacing: 0.55,
} as const

/** "#4a4a4a" → "4A4A4A" (DOCX renk biçimi). */
export function docxColor(hex: string): string {
  return hex.replace("#", "").toUpperCase()
}
