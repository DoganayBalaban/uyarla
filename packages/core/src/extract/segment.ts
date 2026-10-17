import { normalizeText } from "../normalize/turkish.js"
import type { OtherSection, ResumeSegments, StructuredSection } from "../schemas/resume.js"

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

export type ResumeSection = "header" | "summary" | "experience" | "projects" | "education" | "skills" | "ignore"

/**
 * Kodla bölümlemenin çıktısı: LLM bölümleyicisinin şemasına (ResumeSegments)
 * ek olarak projeler ve şemada karşılığı olmayan bölümler (DOG-105).
 */
export interface CodeSegments extends ResumeSegments {
  projectsBlock: string
  otherSections: OtherSection[]
  /**
   * Yapılandırılmış bölümlerin CV'de ilk görüldüğü sıra (DOG-106). Başlık
   * bulunamadıysa yok: sıra bilinmiyor.
   */
  sectionOrder: StructuredSection[] | undefined
}

/** Başlık satırı bu uzunluğu aşmaz; aşıyorsa içerik satırıdır. */
const MAX_HEADING_LENGTH = 60

const LANGUAGE_OR_CERTIFICATE =
  /^(certifications?|certificates|sertifikalar|sertifikalar belgeler|belgeler|languages|diller|yabancı diller?)$/

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
  // Projeler kendi bloğunda (DOG-105). Önceden deneyime gidiyordu, ama
  // deneyim çıkarıcısı kurumu olmayan projeleri kayıt saymıyor ve atıyordu.
  [
    "projects",
    /^(selected\s+|personal\s+|academic\s+|key\s+)?(projects|project experience)$/,
  ],
  ["projects", /^(projeler|seçilmiş projeler|kişisel projeler|akademik projeler|projelerim)$/],
  ["education", /^(education|eğitim|egitim|öğrenim|akademik geçmiş|eğitim bilgileri)$/],
  // Europass (DOG-60): eğitim ve beceri başlıkları bu biçimde yazılıyor.
  ["education", /^(eğitim ve öğretim|education and training)$/],
  ["skills", /^(kişisel beceriler|personal skills|top skills)$/],
  [
    "skills",
    /^((core|technical|teknik|key|other)\s+)?(skills|competencies|beceriler|yetkinlikler|araçlar|tools)$/,
  ],
  ["skills", /^(tech stack|teknolojiler|teknik beceriler|uzmanlık alanları|technologies)$/],
  // Sertifika ve diller beceri bloğuna gider: çıkarıcının bunlar için ayrı
  // alanları var ve düzleştirme onları beceri listesinden eliyor (K-20).
  ["skills", LANGUAGE_OR_CERTIFICATE],
]

/**
 * İletişim bölümleri: içerikleri başlık bloğuna gidiyor, başlık satırı
 * gitmiyor. Europass'ta ad "KİŞİSEL BİLGİLER", LinkedIn çıktısında e-posta
 * "Contact" başlığının altında; başlık satırı bloğa girince ad sanılıyordu
 * (DOG-60).
 */
const CONTACT =
  /^(contact|contact information|iletişim|iletişim bilgileri|kişisel bilgiler|personal information)$/

/**
 * Tanınan ama yapılandırılmış bloklara ait olmayan bölümler. Atılmıyor:
 * başlıklarıyla otherSections'a gidiyor ve indirilen belgeye aynen yazılıyor
 * (DOG-105).
 */
const IGNORED =
  /^(additional|references|referanslar|hobbies|ilgi alanları|awards|honors|ödüller|volunteer|gönüllü çalışmalar|publications|yayınlar|interests)$/

export function segmentResume(rawText: string): CodeSegments {
  const lineItems = rawText.split("\n")
  const blockList: Record<ResumeSection, string[]> = {
    header: [],
    summary: [],
    experience: [],
    projects: [],
    education: [],
    skills: [],
    ignore: [],
  }
  // Yapılandırılmış bloklara girmeyen bölümler, her biri kendi başlığıyla.
  const others: OtherSection[] = []
  const order: StructuredSection[] = []
  // Beceri bölümünün yeri asıl beceri başlığından: diller ve sertifikalar da
  // beceri bloğuna gidiyor ama CV'de çoğu zaman ayrı yerdeler (cv-c'de
  // eğitimden önce). Beceri başlığı hiç yoksa onların yeri kullanılıyor.
  let languagesAt: number | null = null

  // İlk başlıktan önceki satırlar ad, unvan ve iletişim bilgisidir ve kendi
  // bloğuna gidiyor. Sprint 1'de özete karışıyorlardı; skor özeti
  // kullanmadığı için sorun görünmüyordu, indirilen belgede görünür oldu.
  let active: ResumeSection = "header"
  let headingFound = false

  const push = (line: string) => {
    if (active === "ignore") others.at(-1)?.lines.push(line)
    else blockList[active].push(line)
  }

  // İki sütunlu şablonlarda metin iç içe geçiyor (DOG-107): "HAKKIMDA"
  // başlığının hemen ardından "PROFESYONEL DENEYİM" geliyor, özet paragrafı
  // onun altında kalıyor ve deneyim çıkarıcısı onu atıyordu. Özet başlığının
  // altı boşsa, sonraki başlığın altındaki ilk düz yazı paragrafı özete gidiyor.
  let summaryEmpty = false
  let seekingSummary = false
  let lastSummaryLine: string | null = null

  /** Başlık olmayan bir içerik satırını yerine koyar. */
  const place = (line: string) => {
    const t = line.trim()
    // Yalnızca iletişim bilgisi taşıyan satır nerede görünürse görünsün
    // başlık bloğuna (DOG-107): iki sütunlu şablonda e-posta ve LinkedIn
    // deneyimin ortasına düşüyordu. Referanslar gibi bölümlerde değil; oradaki
    // e-posta adayın değil.
    if (t && active !== "header" && active !== "ignore" && isContactLine(t)) {
      blockList.header.push(line)
      return
    }
    if (t && active === "summary") summaryEmpty = false
    if (t && seekingSummary) {
      const fits = lastSummaryLine === null ? startsParagraph(t) : continuesParagraph(t, lastSummaryLine)
      if (fits) {
        blockList.summary.push(line)
        lastSummaryLine = t
        return
      }
      seekingSummary = false
    }
    push(line)
  }

  /** Başlık satırında özet aramasının durumunu günceller. */
  const onHeading = (section: ResumeSection) => {
    seekingSummary = section !== "summary" && section !== "header" && section !== "ignore" && summaryEmpty
    summaryEmpty = section === "summary"
    lastSummaryLine = null
  }

  for (const rawLine of lineItems) {
    // Tablolu DOCX'te başlık ve içerik aynı satırda gelebiliyor (Europass:
    // "KİŞİSEL BİLGİLER | Ece Yıldırım"). Başlık ayrılıp içerik kendi satırına
    // iniyor (DOG-60).
    const [first, ...rest] = rawLine.split(" | ")
    const rowHeading = rest.length > 0 ? headingKind(first!) : null
    const lineItem = rowHeading ? first! : rawLine
    const remainder = rowHeading ? rest.join(" | ") : null

    const section = rowHeading ?? headingKind(lineItem)
    if (section) onHeading(section)
    if (section === "header") {
      active = "header"
      headingFound = true
    } else if (section === "ignore") {
      // Başlığı da saklanıyor: indirilen belgede bölüm aynı adla yer alsın.
      active = "ignore"
      headingFound = true
      others.push({ heading: lineItem.trim(), lines: [] })
    } else {
      if (section) {
        active = section
        headingFound = true
        if (section === "skills" && isLanguageOrCertificate(lineItem)) languagesAt ??= order.length
        else if (section !== "summary" && !order.includes(section)) order.push(section)
      }
      // Başlığın kendisi de bloğa giriyor: K-10'daki kayıp tam da başlıkların
      // atılmasıydı ve çıkarıcılar bağlamdan yararlanıyor.
      if (section) push(lineItem)
      else place(lineItem)
    }
    if (remainder) place(remainder)
  }

  // Hiç başlık yoksa (tasarım ağırlıklı bazı CV'ler) bölemeyiz; her
  // çıkarıcıya ham metnin tamamı verilir. Bugünkü davranıştan kötü değil.
  // Proje çıkarıcısına verilmiyor: aynı maddeler hem deneyim hem proje olarak
  // iki kez çıkardı.
  if (!headingFound) {
    const full = rawText.trim()
    return {
      // Başlık bloğu yine de ilk satırlardan okunuyor: ad çoğu CV'de en
      // üstte ve bölümleme başarısız diye belgeyi adsız bırakmanın anlamı yok.
      headerBlock: full.split("\n").slice(0, 4).join("\n"),
      summaryBlock: full,
      experienceBlock: full,
      projectsBlock: "",
      educationBlock: full,
      skillsBlock: full,
      otherSections: [],
      sectionOrder: undefined,
    }
  }

  return {
    headerBlock: blockList.header.join("\n").trim(),
    summaryBlock: blockList.summary.join("\n").trim(),
    experienceBlock: blockList.experience.join("\n").trim(),
    projectsBlock: blockList.projects.join("\n").trim(),
    educationBlock: blockList.education.join("\n").trim(),
    skillsBlock: blockList.skills.join("\n").trim(),
    // Boş satırlar ve içeriksiz bölümler atılıyor; satırlar olduğu gibi.
    otherSections: others
      .map((o) => ({ heading: o.heading, lines: o.lines.map((l) => l.trim()).filter(Boolean) }))
      .filter((o) => o.lines.length > 0),
    sectionOrder:
      !order.includes("skills") && languagesAt !== null
        ? [...order.slice(0, languagesAt), "skills", ...order.slice(languagesAt)]
        : order,
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
  if (CONTACT.test(n)) return "header"

  for (const [section, pattern] of PATTERNS) {
    if (pattern.test(n)) return section
  }
  return null
}

function isLanguageOrCertificate(lineItem: string): boolean {
  return LANGUAGE_OR_CERTIFICATE.test(normalizeText(lineItem.trim()))
}

const BULLET = /^[•\-*▪–●◦]/
const YEAR = /\b(19|20)\d{2}\b/

/**
 * Özet paragrafının ilk satırı olabilir mi (DOG-107): düz yazı, en az sekiz
 * kelime, madde imi ve yıl yok. Yıl bir iş kaydının başlığını gösterir; boş
 * özet başlığının ardından gelen deneyim kaydını özete almamak için temkinli.
 */
function startsParagraph(t: string): boolean {
  return !BULLET.test(t) && !YEAR.test(t) && t.split(/\s+/).length >= 8
}

/** Önceki satır cümle ortasında bittiyse ya da yeni bir düz yazı cümlesiyse paragraf sürüyor. */
function continuesParagraph(t: string, previous: string): boolean {
  if (BULLET.test(t)) return false
  return !/[.!?]$/.test(previous) || startsParagraph(t)
}

const EMAIL_ANY = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
// Anonimleştirilmiş CV'lerde rakamlar X: "+90 5XX XXX XX XX".
const PHONE_ANY = /\+?\d[\dX\s().-]{8,}[\dX]/g
const URL_ANY = /(?:https?:\/\/)?(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:\/\S*)?/g
const CONTACT_LABEL = /\b(e-?posta|e-?mail|tel|telefon|phone|gsm|cep|linkedin|github|web|portfolio|portföy|site)\b\s*:?/gi

/**
 * Satırda iletişim bilgisinden başka bir şey yok mu (DOG-107). Kişisel bir
 * işaret şart: e-posta, telefon ya da LinkedIn profili. Tek başına bir site
 * adresi bir projenin ya da şirketin olabilir.
 */
function isContactLine(t: string): boolean {
  const personal = /[\w.+-]+@[\w-]+\.[\w-]+/.test(t) || /\+?\d[\dX\s().-]{8,}[\dX]/.test(t) || /linkedin\.com\/in\//i.test(t)
  if (!personal) return false
  const rest = t
    .replace(EMAIL_ANY, "")
    .replace(URL_ANY, "")
    .replace(PHONE_ANY, "")
    .replace(CONTACT_LABEL, "")
    .replace(/[\s|•·,;:/()\-]+/g, "")
  return rest.length === 0
}
