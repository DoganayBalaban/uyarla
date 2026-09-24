import { normalizeText } from "../normalize/turkish.js"
import type { SkillLines } from "../schemas/resume.js"

/**
 * Bir öğenin beceri değil açıklama sayılacağı uzunluk sınırı.
 * "Selenium WebDriver" 18, "Page Object Model (POM)" 23 karakter; bir cümle
 * neredeyse her zaman bunun üstünde.
 */
const MAX_BECERI_UZUNLUGU = 40

/**
 * Kendi başına duran bölüm başlıkları beceri sayılmaz.
 * Karşılaştırma normalizeText'ten geçmiş metinle yapılıyor: JavaScript'in
 * kendi küçültmesi "BECERİLER"i "beceri̇ler" yapıyor (birleşik noktayla) ve
 * eşleşme tutmuyor.
 */
const BOLUM_BASLIGI =
  /^(core|technical|teknik|genel|other|diğer)?\s*(skills?|beceriler|yetkinlikler|araçlar|tools|diller|languages|sertifikalar?|belgeler|certifications?|sertifikalar belgeler|eğitim|education|deneyim|experience)$/

/**
 * Satır transkripsiyonunu beceri listesine çevirir.
 *
 * Kural, gerçek CV'lerde gözlenen iki satır biçiminden çıkarıldı:
 *
 *   "Programming Languages: Java, SQL"   → öğeler beceridir, etiket kategoridir
 *   "Manual Testing: Performing regression testing…" → etiket beceridir, öğe açıklamadır
 *
 * Ayrım öğenin biçiminden yapılıyor: kısa ve nokta içermiyorsa terim,
 * değilse cümle. Bu karar modelden istenmiyor — model iki biçimi
 * karıştırdığında sessizce yanlış veri üretiyordu; kodda yapılınca
 * deterministik ve test edilebilir oluyor (K-19).
 */
export function flattenSkillLines(data: SkillLines): string[] {
  const beceriler: string[] = []

  for (const line of data.lines) {
    const terimler = line.items.filter(
      (item) =>
        item.length <= MAX_BECERI_UZUNLUGU &&
        !item.includes(".") &&
        !bolumBasligiMi(item),
    )

    if (terimler.length > 0) {
      beceriler.push(...terimler)
      continue
    }

    const etiket = line.label.trim()
    if (etiket && !bolumBasligiMi(etiket)) beceriler.push(etiket)
  }

  // Dil ve sertifikalar kendi alanlarında zaten var; beceri sayılmamalılar.
  // Beceri bölümü olmayan CV'lerde bölümleme diller ve sertifikaları
  // skillsBlock'a koyuyor ve bunlar beceri gibi görünüyor. Bir katılım
  // belgesinin "Bilgisayar Mühendisliği mezunu" gereksinimiyle eşleşmesi
  // uydurma eşleşmedir (K-20).
  const digerleri = new Set(
    [...data.languages, ...data.certifications].map((x) => normalizeText(x)),
  )

  return [
    ...new Set(
      beceriler.filter((b) => {
        const n = normalizeText(b)
        return n.length > 0 && !digerleri.has(n)
      }),
    ),
  ]
}

function bolumBasligiMi(metin: string): boolean {
  return BOLUM_BASLIGI.test(normalizeText(metin))
}
