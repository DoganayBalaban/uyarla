import { resumeLanguage, type Language } from "../normalize/language.js"
import type { ResumeProfile } from "../schemas/resume.js"

export interface DocumentEntry {
  heading: string | null
  subheading: string | null
  lines: string[]
}

export interface DocumentSection {
  title: string
  entries: DocumentEntry[]
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
const HEADINGS: Record<Language, Record<"experience" | "education" | "skills" | "languages" | "certifications", string>> = {
  tr: { experience: "DENEYİM", education: "EĞİTİM", skills: "BECERİLER", languages: "DİLLER", certifications: "SERTİFİKALAR" },
  en: { experience: "EXPERIENCE", education: "EDUCATION", skills: "SKILLS", languages: "LANGUAGES", certifications: "CERTIFICATIONS" },
}

export interface DocumentOptions {
  /**
   * Eğitim deneyimden önce. İlk işini arayan kullanıcıda okulu ve projeleri
   * deneyim listesinin altına gömmemek için (DOG-55).
   */
  educationFirst?: boolean
}

export function toDocumentModel(profile: ResumeProfile, options: DocumentOptions = {}): DocumentModel {
  const sections: DocumentSection[] = []
  const b = HEADINGS[resumeLanguage(profile)]

  if (profile.experience.length > 0) {
    sections.push({
      title: b.experience,
      entries: profile.experience.map((job) => ({
        heading: `${job.title} · ${job.company}`,
        subheading: `${job.startDate} – ${job.endDate}`,
        lines: job.bullets.map((b) => b.text),
      })),
    })
  }

  if (profile.education.length > 0) {
    sections.push({
      title: b.education,
      entries: profile.education.map((edu) => ({
        heading: [edu.school, edu.degree, edu.field].filter(Boolean).join(" · "),
        // startDate eski profillerde yok (bkz. EducationSchema).
        subheading: edu.startDate && edu.endDate ? `${edu.startDate} – ${edu.endDate}` : edu.endDate,
        lines: [],
      })),
    })
  }

  if (options.educationFirst) {
    const education = sections.findIndex((s) => s.title === b.education)
    if (education > 0) sections.unshift(...sections.splice(education, 1))
  }

  // Beceriler tek satırda virgülle: ATS tarayıcıları bu biçimi en güvenilir
  // ayrıştırıyor ve madde listesi belgeyi gereksiz uzatıyor.
  if (profile.skills.length > 0) {
    sections.push({
      title: b.skills,
      entries: [{ heading: null, subheading: null, lines: [profile.skills.join(", ")] }],
    })
  }

  if (profile.languages.length > 0) {
    sections.push({
      title: b.languages,
      entries: [{ heading: null, subheading: null, lines: [profile.languages.join(", ")] }],
    })
  }

  if (profile.certifications.length > 0) {
    sections.push({
      title: b.certifications,
      entries: [{ heading: null, subheading: null, lines: profile.certifications }],
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
