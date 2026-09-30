import { normalizeText } from "../normalize/turkish.js"
import type { ResumeSegments } from "../schemas/resume.js"

/**
 * CV'yi bölümlerine kodla ayırır.
 *
 * Bu iş LLM'e verilmişti ve iki kez kırıldı: bir kez başlık satırlarını
 * bloğa koymayarak (K-10), bir kez de bölümleri yanlış etiketleyerek —
 * "TECHNICAL SKILLS" deneyim bloğuna, "ADDITIONAL" beceri bloğuna gitmişti.
 * İkincisinde CV'de açıkça yazan MCP, tool calling ve Docker hiç beceri
 * olarak çıkmadı.
 *
 * Metni başlığına göre kesmek deterministik bir iş; dil modeline ihtiyacı
 * yok. Kodda yapılınca kırıldığında sessiz değil kırmızı oluyor, her CV'de
 * ~10 saniye kazandırıyor ve üretimde bir çağrılık token maliyeti düşüyor.
 */

export type ResumeSection = "header" | "summary" | "experience" | "education" | "skills" | "ignore"

/** Başlık satırı bu uzunluğu aşmaz; aşıyorsa içerik satırıdır. */
const MAX_HEADING_LENGTH = 60

const PATTERNS: Array<[ResumeSection, RegExp]> = [
  [
    "summary",
    /^(profile|profil|hakkimda|özet|ozet|summary|about( me)?|profesyonel özet|kariyer özeti)$/,
  ],
  // Ölçümle eklendi: değerlendirme CV'lerinden birinde "Professional Summary"
  // tanınmıyordu ve özet bölümü tümüyle başlık bloğunda kalıyordu.
  [
    "summary",
    /^(professional|career|personal)\s+(summary|profile|statement)$/,
  ],
  ["experience", /^((work|professional|relevant)\s+)?(experience|employment|history)$/],
  ["experience", /^(iş\s+)?(deneyim|deneyimler|deneyimi|tecrübe|tecrübeler)$/],
  ["experience", /^(profesyonel deneyim|çalışma deneyimi|iş tecrübesi|kariyer geçmişi)$/],
  // Projeler deneyim sayılır: kanıt olarak aynı işi görüyorlar.
  [
    "experience",
    /^(selected\s+)?(projects|projeler|seçilmiş projeler|kişisel projeler|project experience)$/,
  ],
  ["education", /^(education|eğitim|egitim|öğrenim|akademik geçmiş|eğitim bilgileri)$/],
  [
    "skills",
    /^((core|technical|teknik|key|other)\s+)?(skills|competencies|beceriler|yetkinlikler|araçlar|tools)$/,
  ],
  ["skills", /^(tech stack|teknolojiler|teknik beceriler|uzmanlık alanları|technologies)$/],
  // Sertifika ve diller beceri bloğuna gider: çıkarıcının bunlar için ayrı
  // alanları var ve düzleştirme onları beceri listesinden eliyor (K-20).
  [
    "skills",
    /^(certifications?|certificates|sertifikalar|sertifikalar belgeler|belgeler|languages|diller|yabancı diller?)$/,
  ],
]

/** Tanınan ama dört bloğun hiçbirine ait olmayan bölümler. */
const IGNORED =
  /^(additional|references|referanslar|hobbies|ilgi alanları|awards|honors|ödüller|volunteer|gönüllü çalışmalar|publications|yayınlar|interests)$/

export function segmentResume(rawText: string): ResumeSegments {
  const lineItems = rawText.split("\n")
  const blockList: Record<ResumeSection, string[]> = {
    header: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    ignore: [],
  }

  // İlk başlıktan önceki satırlar ad, unvan ve iletişim bilgisidir ve kendi
  // bloğuna gidiyor. Sprint 1'de özete karışıyorlardı; skor özeti
  // kullanmadığı için sorun görünmüyordu, indirilen belgede görünür oldu.
  let active: ResumeSection = "header"
  let headingFound = false

  for (const lineItem of lineItems) {
    const section = headingKind(lineItem)
    if (section) {
      active = section
      headingFound = true
    }
    // Başlığın kendisi de bloğa giriyor: K-10'daki kayıp tam da başlıkların
    // atılmasıydı ve çıkarıcılar bağlamdan yararlanıyor.
    blockList[active].push(lineItem)
  }

  // Hiç başlık yoksa (tasarım ağırlıklı bazı CV'ler) bölemeyiz; her
  // çıkarıcıya ham metnin tamamı verilir. Bugünkü davranıştan kötü değil.
  if (!headingFound) {
    const full = rawText.trim()
    return {
      // Başlık bloğu yine de ilk satırlardan okunuyor: ad çoğu CV'de en
      // üstte ve bölümleme başarısız diye belgeyi adsız bırakmanın anlamı yok.
      headerBlock: full.split("\n").slice(0, 4).join("\n"),
      summaryBlock: full,
      experienceBlock: full,
      educationBlock: full,
      skillsBlock: full,
    }
  }

  return {
    headerBlock: blockList.header.join("\n").trim(),
    summaryBlock: blockList.summary.join("\n").trim(),
    experienceBlock: blockList.experience.join("\n").trim(),
    educationBlock: blockList.education.join("\n").trim(),
    skillsBlock: blockList.skills.join("\n").trim(),
  }
}

/**
 * Bloğun başındaki bölüm başlığını atar.
 *
 * Başlıklar bloklara bilerek dahil ediliyor (K-10): çıkarıcılar bağlamdan
 * yararlanıyor. Ama özet metni belgeye olduğu gibi yazılıyor ve orada
 * "PROFILE" satırı bir başlık değil, özetin ilk kelimesi gibi görünüyor.
 */
export function stripLeadingHeading(block: string): string {
  const lineItems = block.split("\n")
  const firstNonEmpty = lineItems.findIndex((s) => s.trim())
  if (firstNonEmpty === -1) return ""
  if (!headingKind(lineItems[firstNonEmpty]!)) return block.trim()
  return lineItems.slice(firstNonEmpty + 1).join("\n").trim()
}

/**
 * Satır tanınan bir bölüm başlığıysa türünü döndürür. Biçim kontrolü
 * (format/check.ts) aynı tanımayı kullanıyor: "ATS başlığını tanır mı"
 * sorusunun cevabı, bizim bölümlememizin tanıyıp tanımadığıyla aynı.
 */
export function sectionHeading(lineItem: string): ResumeSection | null {
  return headingKind(lineItem)
}

function headingKind(lineItem: string): ResumeSection | null {
  const clean = lineItem.trim()
  if (!clean || clean.length > MAX_HEADING_LENGTH) return null

  const n = normalizeText(clean)
  if (!n) return null
  if (IGNORED.test(n)) return "ignore"

  for (const [section, pattern] of PATTERNS) {
    if (pattern.test(n)) return section
  }
  return null
}
