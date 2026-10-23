import { z } from "zod"
import type { ResumeProfile } from "../schemas/resume.js"
import { CITIES } from "../score/conditions.js"

/**
 * LinkedIn profil denetiminin tek profil yapısı (spec §3.1). Eklenti bunu
 * kullanıcının kendi profil sayfasından üretiyor; PDF yolunda CV okuyucusunun
 * profilinden çevriliyor. Teşhis ve yazım yalnızca bunu görüyor.
 */
export const PROFILE_LIMITS = { text: 3000, experience: 30, education: 15, certifications: 50, skills: 100, languages: 20 } as const

const text = z.string().trim().max(PROFILE_LIMITS.text)
const optionalText = text.nullable()
const required = z.string().trim().min(1).max(PROFILE_LIMITS.text)
const count = z.object({ shown: z.number().int().min(0), total: z.number().int().min(0).nullable() })

export const LinkedInProfileDataSchema = z.object({
  name: optionalText,
  headline: optionalText,
  about: optionalText,
  experience: z
    .array(z.object({ title: required, company: optionalText, dateRange: optionalText, location: optionalText, description: optionalText }))
    .max(PROFILE_LIMITS.experience),
  education: z
    .array(z.object({ school: required, degree: optionalText, dateRange: optionalText, description: optionalText }))
    .max(PROFILE_LIMITS.education),
  certifications: z.array(z.object({ name: required, issuer: optionalText, date: optionalText })).max(PROFILE_LIMITS.certifications),
  skills: z.array(required).max(PROFILE_LIMITS.skills),
  languages: z.array(required).max(PROFILE_LIMITS.languages),
  /** Ana profil sayfası bölümü kısalttıysa: gösterilen ve toplam (spec §5.1). */
  truncated: z.object({ experience: count, education: count, certifications: count, skills: count }).partial(),
})

export type LinkedInProfileData = z.infer<typeof LinkedInProfileDataSchema>

/** "Mar 2023 - Present · 2 yrs 8 mos" → başlangıç ve bitiş; süre atılıyor. */
export function splitDateRange(range: string | null): { start: string; end: string } {
  if (!range?.trim()) return { start: "", end: "" }
  const main = range.split("·")[0]!.trim()
  const [start = "", end] = main.split(/\s+[-–—]\s+/)
  return { start: start.trim(), end: (end ?? start).trim() }
}

/** Açıklamanın dolu satırları, madde işaretleri atılmış. */
export function descriptionLines(description: string | null): string[] {
  return (description ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s•●▪◦\-–*·]+/, "").trim())
    .filter(Boolean)
}

/**
 * Mevcut yardımcıların (resumeFacts, headlineTitles, resumeLanguage,
 * verifyCoverLetter) okuduğu biçim. Madde metni kaynağın kendisi: doğrulama
 * bununla karşılaştırıyor.
 */
export function toResumeProfile(p: LinkedInProfileData): ResumeProfile {
  return {
    fullName: p.name,
    headline: p.headline,
    summary: p.about,
    experience: p.experience.map((e) => {
      const { start, end } = splitDateRange(e.dateRange)
      return {
        company: e.company ?? "",
        title: e.title,
        startDate: start,
        endDate: end,
        bullets: descriptionLines(e.description).map((line) => ({ text: line, sourceRef: line })),
      }
    }),
    education: p.education.map((e) => {
      const { start, end } = splitDateRange(e.dateRange)
      return { school: e.school, degree: e.degree, field: null, startDate: start || null, endDate: end || null }
    }),
    skills: p.skills,
    languages: p.languages,
    certifications: p.certifications.map((c) => c.name),
  }
}

const CONTACT = /@|https?:\/\/|www\.|linkedin\.com/i
const PHONE = /^\+?[\d\s().-]{7,}$/
const PLACES = new Set(["türkiye", "turkey", ...CITIES.map((c) => c.toLocaleLowerCase("tr"))])
/** "Pendik, İstanbul", "İstanbul, Türkiye", "Ankara": son parçası il ya da ülke. Virgül tek başına yetmiyor ("Google Ads, GA4"). */
const isPlace = (part: string) => PLACES.has(part.split(",").pop()!.trim().toLocaleLowerCase("tr"))

/**
 * CV okuyucusu LinkedIn PDF'inde başlığın altındaki konum ve iletişim
 * satırlarını başlığa katabiliyor ("Unvan · İstanbul · ad@ornek.com"; skor
 * tarafında da aynı: score/title.ts). Yalnızca açıkça iletişim ya da yer olan
 * parçalar atılıyor.
 */
function cleanPdfHeadline(headline: string | null): string | null {
  if (!headline?.trim()) return null
  const parts = headline.split(/\s*[·•]\s*/).map((p) => p.trim())
  const kept = parts.filter((p) => p && !CONTACT.test(p) && !PHONE.test(p) && !isPlace(p))
  if (kept.length === parts.length) return headline.trim()
  return kept.join(" · ") || null
}

/**
 * PDF yolu: CV okuyucusunun profili; maddeler açıklama oluyor. LinkedIn PDF'i
 * becerilerin yalnızca ilk birkaçını ("Top Skills") yazıyor: liste kısmi, toplamı bilinmiyor.
 */
export function fromResumeProfile(r: ResumeProfile): LinkedInProfileData {
  const range = (start: string | null | undefined, end: string | null | undefined) => [start, end].filter(Boolean).join(" - ") || null
  return {
    name: r.fullName,
    headline: cleanPdfHeadline(r.headline),
    about: r.summary,
    experience: r.experience.map((e) => ({
      title: e.title,
      company: e.company || null,
      dateRange: range(e.startDate, e.endDate),
      location: null,
      description: e.bullets.map((b) => b.text).join("\n") || null,
    })),
    education: r.education.map((e) => ({
      school: e.school,
      degree: [e.degree, e.field].filter(Boolean).join(", ") || null,
      dateRange: range(e.startDate, e.endDate),
      description: null,
    })),
    certifications: r.certifications.map((name) => ({ name, issuer: null, date: null })),
    skills: r.skills,
    languages: r.languages,
    truncated: { skills: { shown: r.skills.length, total: null } },
  }
}
