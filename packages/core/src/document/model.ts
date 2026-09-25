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

export function toDocumentModel(profile: ResumeProfile): DocumentModel {
  const sections: DocumentSection[] = []

  if (profile.experience.length > 0) {
    sections.push({
      title: "DENEYİM",
      entries: profile.experience.map((job) => ({
        heading: `${job.title} · ${job.company}`,
        subheading: `${job.startDate} – ${job.endDate}`,
        lines: job.bullets.map((b) => b.text),
      })),
    })
  }

  if (profile.education.length > 0) {
    sections.push({
      title: "EĞİTİM",
      entries: profile.education.map((edu) => ({
        heading: [edu.school, edu.degree, edu.field].filter(Boolean).join(" · "),
        subheading: edu.endDate,
        lines: [],
      })),
    })
  }

  // Beceriler tek satırda virgülle: ATS tarayıcıları bu biçimi en güvenilir
  // ayrıştırıyor ve madde listesi belgeyi gereksiz uzatıyor.
  if (profile.skills.length > 0) {
    sections.push({
      title: "BECERİLER",
      entries: [{ heading: null, subheading: null, lines: [profile.skills.join(", ")] }],
    })
  }

  if (profile.languages.length > 0) {
    sections.push({
      title: "DİLLER",
      entries: [{ heading: null, subheading: null, lines: [profile.languages.join(", ")] }],
    })
  }

  if (profile.certifications.length > 0) {
    sections.push({
      title: "SERTİFİKALAR",
      entries: [{ heading: null, subheading: null, lines: profile.certifications }],
    })
  }

  return {
    // Adsız belge üretmiyoruz: başlıksız bir CV ATS'te kimliksiz kalır.
    name: profile.fullName?.trim() || "İsimsiz",
    contact: profile.headline,
    // Boş özet null sayılıyor: uyarlama reddedilmiş bir özette boş metin
    // bırakabiliyor ve belgede başlıksız bir boşluk çıkardı.
    summary: profile.summary?.trim() || null,
    sections,
  }
}
