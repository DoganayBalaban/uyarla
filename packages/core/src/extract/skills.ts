import { normalizeText } from "../normalize/turkish.js"
import { sectionHeading } from "./segment.js"
import type { SkillLines } from "../schemas/resume.js"

/**
 * Bir öğenin beceri değil açıklama sayılacağı uzunluk sınırı.
 * "Selenium WebDriver" 18, "Page Object Model (POM)" 23 karakter; bir cümle
 * neredeyse her zaman bunun üstünde.
 */
const MAX_SKILL_LENGTH = 40

/**
 * Kendi başına duran bölüm başlıkları beceri sayılmaz.
 * Karşılaştırma normalizeText'ten geçmiş metinle yapılıyor: JavaScript'in
 * kendi küçültmesi "BECERİLER"i "beceri̇ler" yapıyor (birleşik noktayla) ve
 * eşleşme tutmuyor.
 */
const SECTION_HEADING =
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
  const skillList: string[] = []

  for (const line of data.lines) {
    const termList = line.items.filter(
      (item) => looksLikeTerm(item) && !isSectionHeading(item),
    )

    if (termList.length > 0) {
      skillList.push(...termList)
      continue
    }

    // Etikete de aynı ölçüt uygulanıyor: bölümlemenin karıştığı CV'lerde
    // deneyim cümleleri beceri bloğuna sızabiliyor ve etiket olarak geliyor.
    const headingLabel = line.label.trim()
    if (headingLabel && looksLikeTerm(headingLabel) && !isSectionHeading(headingLabel)) {
      skillList.push(headingLabel)
    }
  }

  // Dil ve sertifikalar kendi alanlarında zaten var; beceri sayılmamalılar.
  // Beceri bölümü olmayan CV'lerde bölümleme diller ve sertifikaları
  // skillsBlock'a koyuyor ve bunlar beceri gibi görünüyor. Bir katılım
  // belgesinin "Bilgisayar Mühendisliği mezunu" gereksinimiyle eşleşmesi
  // uydurma eşleşmedir (K-20).
  const others = new Set(
    [...data.languages, ...data.certifications].map((x) => normalizeText(x)),
  )

  return [
    ...new Set(
      skillList.filter((b) => {
        const n = normalizeText(b)
        return n.length > 0 && !others.has(n)
      }),
    ),
  ]
}

/**
 * Kısa ve cümle noktası taşımayan metin terimdir; değilse cümledir.
 *
 * Kelime içindeki nokta cümle işareti değil: "Next.js", "Vue.js", "Node.js",
 * "ASP.NET". İlk sürüm her noktayı cümle sayıyordu ve bu beceriler sessizce
 * listeden düşüyor, indirilen CV'de de kayboluyordu (K-38). Cümle noktası
 * sonda ya da boşluktan önce durur.
 */
/**
 * Tek başına bir düzey ifadesi beceri değil: tablolu şablonlarda düzey ayrı
 * sütunda duruyor ve beceri sanılıyordu (DOG-60).
 */
const LEVEL =
  "(?:başlangıç|temel|orta|iyi|çok|ileri|uzman|seviye|düzey|beginner|basic|elementary|intermediate|good|advanced|expert|fluent|native|[abc][12])"
// normalizeText parantezleri siliyor: "B2 (iyi)" → "b2 iyi".
const PROFICIENCY = new RegExp(`^${LEVEL}(?:\\s+${LEVEL})*$`)

function looksLikeTerm(text: string): boolean {
  const t = text.trim()
  // " | " tablolu şablonun hücre ayırıcısı (DOG-60): "Alan | Düzey" bir
  // tablo başlığı, beceri değil.
  return (
    t.length <= MAX_SKILL_LENGTH &&
    !/\.(\s|$)/.test(t) &&
    !t.includes(" | ") &&
    !PROFICIENCY.test(normalizeText(t))
  )
}

function isSectionHeading(text: string): boolean {
  // Bölümlemenin tanıdığı her başlık da ("Top Skills", "KİŞİSEL BECERİLER") başlıktır.
  return SECTION_HEADING.test(normalizeText(text)) || sectionHeading(text) !== null
}
