import { resumeLanguage, type Language } from "../normalize/language.js"
import type { ResumeProfile, StructuredSection, TitledSection } from "../schemas/resume.js"

/**
 * Bir kayıt: iş, proje ya da okul. Başlık satırı üç parça (DOG-106): kalın
 * `heading` (unvan, okul, proje adı), yanında düz `organization` (şirket,
 * bölüm, rol) ve sağa yaslı `date`. Önceden hepsi tek satıra "·" ile
 * yapıştırılıyordu ve K2'de belge "düz yazı" gibi okundu.
 */
export interface DocumentEntry {
  heading: string | null
  organization: string | null
  date: string | null
  /** Madde imli satırlar. */
  lines: string[]
}

/**
 * Madde imsiz satır: beceri grupları ve diller ("Backend: Python, FastAPI").
 * Etiket kalın yazılıyor; yoksa satır düz.
 */
export interface DocumentRow {
  label: string | null
  text: string
}

export interface DocumentSection {
  title: string
  entries: DocumentEntry[]
  rows?: DocumentRow[]
}

/**
 * Yerleşimden bağımsız belge yapısı (spec §9).
 *
 * Yerleşim kararları burada veriliyor, üreteçler yalnızca çiziyor. PDF ile
 * DOCX'in ayrı ayrı "unvanı nasıl yazalım" kararı vermesi, ikisinin zamanla
 * birbirinden ayrışması demek olurdu.
 */
export interface DocumentModel {
  name: string
  contact: string | null
  summary: string | null
  sections: DocumentSection[]
}

/**
 * Bölüm başlıkları CV'nin dilinde. Sabit Türkçe başlıklar İngilizce bir
 * CV'yi "DENEYİM", "BECERİLER" başlıklarıyla indirtiyordu (K-39).
 */
const HEADINGS: Record<
  Language,
  Record<"experience" | "projects" | "education" | "skills" | "languages" | "certifications", string>
> = {
  tr: {
    experience: "DENEYİM",
    projects: "PROJELER",
    education: "EĞİTİM",
    skills: "BECERİLER",
    languages: "DİLLER",
    certifications: "SERTİFİKALAR",
  },
  en: {
    experience: "EXPERIENCE",
    projects: "PROJECTS",
    education: "EDUCATION",
    skills: "SKILLS",
    languages: "LANGUAGES",
    certifications: "CERTIFICATIONS",
  },
}

export interface DocumentOptions {
  /**
   * Eğitim deneyimden önce. İlk işini arayan kullanıcıda okulu ve projeleri
   * deneyim listesinin altına gömmemek için (DOG-55).
   */
  educationFirst?: boolean
}

export function toDocumentModel(profile: ResumeProfile, options: DocumentOptions = {}): DocumentModel {
  const language = resumeLanguage(profile)
  const b = HEADINGS[language]
  // Harf ya da rakam taşımayan tarih yok sayılıyor: model JSON'u kırık
  // yazdığında alana "},{" girebiliyor ve belgede tarih yerine çıkıyordu.
  // Unicode tireler ASCII kısa çizgiye çevriliyor (DOG-114): birçok ATS tarih
  // aralığını yalnızca "-" ile bölüyor; Workday içe aktarımında "2016–2024"
  // biçimi bitiş tarihini ve eğitim girdilerini düşürmüş (ai-job-search).
  const clean = (d: string | null | undefined) =>
    d && /[\p{L}\p{N}]/u.test(d) ? d.replace(UNICODE_DASH, "-") : null
  const range = (start: string | null | undefined, end: string | null | undefined) => {
    const [s, e] = [clean(start), clean(end)]
    return s && e ? `${s} - ${e}` : e || s || null
  }

  // Bölümler türüne göre kuruluyor, sonra CV'deki sıraya diziliyor.
  const built: Partial<Record<StructuredSection, DocumentSection[]>> = {}

  if (profile.experience.length > 0) {
    built.experience = [
      {
        title: titleOf(profile, "experience", b.experience),
        entries: profile.experience.map((job) => ({
          heading: job.title,
          organization: job.company,
          date: range(job.startDate, job.endDate),
          lines: job.bullets.map((b) => oneLine(b.text)),
        })),
      },
    ]
  }

  // Projeler kaybolmuyor (DOG-105). Önceden çıkarıcı onları atıyordu ve
  // yeni mezun CV'sinin çoğu kayboluyordu.
  const projects = profile.projects ?? []
  if (projects.length > 0) {
    built.projects = [
      {
        title: titleOf(profile, "projects", b.projects),
        entries: projects.map((p) => ({
          heading: p.name,
          organization: p.role,
          date: range(p.startDate, p.endDate),
          lines: p.bullets.map((x) => oneLine(x.text)),
        })),
      },
    ]
  }

  if (profile.education.length > 0) {
    built.education = [
      {
        title: titleOf(profile, "education", b.education),
        entries: profile.education.map((edu) => ({
          heading: edu.school,
          organization: [edu.degree, edu.field].filter(Boolean).join(" · ") || null,
          // startDate eski profillerde yok (bkz. EducationSchema).
          date: range(edu.startDate, edu.endDate),
          lines: [],
        })),
      },
    ]
  }

  // Diller ve sertifikalar beceri bölümünün ardından: CV'de çoğu zaman aynı
  // bloktalar (bölümleme de onları beceri bloğuna koyuyor).
  const skillSections: DocumentSection[] = []
  if (profile.skills.length > 0) {
    skillSections.push({ title: titleOf(profile, "skills", b.skills), entries: [], rows: skillRows(profile) })
  }
  if (profile.languages.length > 0) {
    skillSections.push({
      title: titleOf(profile, "languages", b.languages),
      entries: [],
      rows: [{ label: null, text: profile.languages.join(", ") }],
    })
  }
  if (profile.certifications.length > 0) {
    skillSections.push({
      title: titleOf(profile, "certifications", b.certifications),
      entries: [{ heading: null, organization: null, date: null, lines: profile.certifications }],
    })
  }
  if (skillSections.length > 0) built.skills = skillSections

  const sections = sectionOrder(profile, options).flatMap((kind) => built[kind] ?? [])

  // Şemada karşılığı olmayan bölümler sonda, CV'deki adlarıyla ve olduğu
  // gibi (DOG-105): kullanıcının yazdığı hiçbir bölüm sessizce düşmesin.
  for (const other of profile.otherSections ?? []) {
    sections.push({
      title: other.heading.toLocaleUpperCase(language === "tr" ? "tr" : "en"),
      entries: [{ heading: null, organization: null, date: null, lines: other.lines }],
    })
  }

  return {
    // Adsız belge üretmiyoruz: başlıksız bir CV ATS'te kimliksiz kalır.
    name: profile.fullName?.trim() || "İsimsiz",
    contact: profile.headline,
    // Boş özet null sayılıyor: uyarlama reddedilmiş bir özette boş metin
    // bırakabiliyor ve belgede başlıksız bir boşluk çıkardı.
    // PDF'ten gelen satır sonları cümlenin ortasında duruyor ve belgede
    // kırık satır olarak görünüyordu (K-38). Önceden kaydedilmiş profiller
    // için burada da birleştiriliyor.
    summary: profile.summary?.replace(/\s*\n\s*/g, " ").trim() || null,
    sections,
  }
}

/** Kısa çizgi dışındaki tireler: ‐ ‑ ‒ – — ― ve eksi işareti. */
const UNICODE_DASH = /[\u2010-\u2015\u2212]/g

const DEFAULT_ORDER: StructuredSection[] = ["experience", "projects", "education", "skills"]

/**
 * Bölüm sırası (DOG-106): CV'deki sıra biliniyorsa o, CV'de olmayan bölüm
 * varsayılan yerine. Bilinmiyorsa varsayılan; ilk işini arayanda eğitim
 * öne (DOG-55). Adayın kendi sırası hedef tercihinden önce geliyor: K2'de
 * "mevcut formatımı bozmasın" istendi ve eğitimi sona koyan aday bunu
 * bilerek yapmış.
 */
/** Bölüm başlığı: kullanıcının verdiği ad (DOG-92), yoksa varsayılan; diğer başlıklar gibi büyük harf. */
function titleOf(profile: ResumeProfile, kind: TitledSection, fallback: string): string {
  const custom = profile.sectionTitles?.[kind]?.trim()
  if (!custom) return fallback
  return custom.toLocaleUpperCase(resumeLanguage(profile) === "tr" ? "tr" : "en")
}

/** Belgedeki yapılandırılmış bölüm başlıkları (DOG-92): ekran indirmeyle aynısını göstersin. */
export function sectionHeadings(profile: ResumeProfile): Record<TitledSection, string> {
  const b = HEADINGS[resumeLanguage(profile)]
  return {
    experience: titleOf(profile, "experience", b.experience),
    projects: titleOf(profile, "projects", b.projects),
    education: titleOf(profile, "education", b.education),
    skills: titleOf(profile, "skills", b.skills),
    languages: titleOf(profile, "languages", b.languages),
    certifications: titleOf(profile, "certifications", b.certifications),
  }
}

export function sectionOrder(profile: ResumeProfile, options: DocumentOptions = {}): StructuredSection[] {
  const known = profile.sectionOrder ?? []
  if (known.length === 0) {
    if (!options.educationFirst) return DEFAULT_ORDER
    return ["education", ...DEFAULT_ORDER.filter((k) => k !== "education")]
  }
  const order = [...known]
  for (const [i, kind] of DEFAULT_ORDER.entries()) {
    if (order.includes(kind)) continue
    // Varsayılanda kendisinden önce gelen son bilinen bölümün arkasına.
    const previous = DEFAULT_ORDER.slice(0, i).reverse().find((k) => order.includes(k))
    order.splice(previous ? order.indexOf(previous) + 1 : 0, 0, kind)
  }
  return order
}

/**
 * Beceri satırları (DOG-106). CV kategori yazmışsa her kategori bir satır
 * ("Backend: Python, FastAPI"), CV'deki sırayla; grup içinde uyarlamanın
 * sırası korunuyor. Hiçbir gruba girmeyenler (uyarlamanın eklediği beceriler)
 * sonda ayrı satırda. Kategori yoksa tek satır, virgüllü: ATS bu biçimi
 * güvenilir ayrıştırıyor ve madde listesi belgeyi uzatıyor.
 */
function skillRows(profile: ResumeProfile): DocumentRow[] {
  const groups = profile.skillGroups ?? []
  const rank = new Map(profile.skills.map((s, i) => [s, i]))
  const placed = new Set<string>()
  const rows: DocumentRow[] = []
  for (const group of groups) {
    const items = group.items
      .filter((s) => rank.has(s) && !placed.has(s))
      .sort((x, y) => rank.get(x)! - rank.get(y)!)
    if (items.length === 0) continue
    for (const s of items) placed.add(s)
    rows.push({ label: group.name, text: items.join(", ") })
  }
  const rest = profile.skills.filter((s) => !placed.has(s))
  if (rest.length > 0) rows.push({ label: null, text: rest.join(", ") })
  return rows
}

/**
 * PDF'ten gelen satır sonu maddenin ortasında kalıyor ve belgede kırık satır
 * olarak görünüyordu ("…and cart / functionalities", cv-b). Özetteki gibi
 * (K-38) birleştiriliyor.
 */
function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, " ").trim()
}
