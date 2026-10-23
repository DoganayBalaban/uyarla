import type { LinkedInProfileData } from "./profileData.js"

/**
 * Eklentinin kullanıcının kendi LinkedIn profil sayfasından topladığı görünen
 * satırlar (DOG-157, spec §5.2). Sayfa betiği yalnızca satırları topluyor; yorum
 * burada, saf ve testli. LinkedIn sayfa yapısını değiştirince düzeltme de burada.
 */
export type SnapshotSection = "experience" | "education" | "certifications" | "skills" | "languages"

export interface ProfileSnapshot {
  url: string
  /** Yalnızca sahibine görünen "Profil bölümü ekle" düğmesi var mı. */
  own: boolean
  name: string | null
  headline: string | null
  about: string | null
  sections: Partial<Record<SnapshotSection, { items: string[][]; showAllText: string | null }>>
}

const YEAR = /\b(19|20)\d{2}\b|\b(Present|Halen|Günümüz|Hâlâ|Devam ediyor)\b/i
const EMPLOYMENT = /\s+·\s+(Full-time|Part-time|Internship|Contract|Freelance|Self-employed|Seasonal|Apprenticeship|Tam zamanlı|Yarı zamanlı|Stajyer|Staj|Sözleşmeli|Serbest|Serbest çalışan|Mevsimlik|Çırak)\s*$/i
const WORK_MODE = /(Remote|Uzaktan|Hybrid|Hibrit|On-site|İş yerinde|Ofiste)\s*$/i
const SKILLS_LINE = /^(Skills|Yetenekler|Beceriler)\s*:/i
const SEE_MORE = /^[….]*\s*(daha fazla göster|daha fazla gör|see more|show more)$/i
const ISSUED = /^(Issued|Veriliş tarihi|Verilme tarihi|Alındı)\s*:?\s*/i
const CREDENTIAL = /^(Credential ID|Kimlik bilgisi kimliği|Sertifika kimliği)\b/i

const clean = (lines: string[]) => lines.map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l && !SEE_MORE.test(l))

function experienceItem(raw: string[]): LinkedInProfileData["experience"][number] | null {
  const lines = clean(raw)
  const title = lines.shift()
  if (!title) return null
  let company: string | null = null
  if (lines[0] && !YEAR.test(lines[0])) company = lines.shift()!.replace(EMPLOYMENT, "").trim() || null
  const dateRange = lines[0] && YEAR.test(lines[0]) ? lines.shift()! : null
  // Konum: kısa ve tarih değil; virgüllü yer adı ya da çalışma biçimiyle bitiyor.
  const next = lines[0]
  const location =
    next && next.length <= 80 && !YEAR.test(next) && (next.includes(",") || WORK_MODE.test(next)) && !/[.!?…]$/.test(next) && !next.startsWith("•") ? lines.shift()! : null
  const description = lines.filter((l) => !SKILLS_LINE.test(l)).join("\n") || null
  return { title, company, dateRange, location, description }
}

function educationItem(raw: string[]): LinkedInProfileData["education"][number] | null {
  const lines = clean(raw)
  const school = lines.shift()
  if (!school) return null
  const degree = lines[0] && !YEAR.test(lines[0]) ? lines.shift()! : null
  const dateRange = lines[0] && YEAR.test(lines[0]) ? lines.shift()! : null
  return { school, degree, dateRange, description: lines.join("\n") || null }
}

function certificationItem(raw: string[]): LinkedInProfileData["certifications"][number] | null {
  const lines = clean(raw).filter((l) => !CREDENTIAL.test(l))
  const name = lines.shift()
  if (!name) return null
  const issuer = lines[0] && !ISSUED.test(lines[0]) ? lines.shift()! : null
  const dateLine = lines.find((l) => ISSUED.test(l))
  return { name, issuer, date: dateLine ? dateLine.replace(ISSUED, "").split("·")[0]!.trim() || null : null }
}

function truncation(section: { items: string[][]; showAllText: string | null } | undefined) {
  const total = section?.showAllText?.match(/\d+/)?.[0]
  return section && total ? { shown: section.items.length, total: Number(total) } : undefined
}

export function profileFromSnapshot(s: ProfileSnapshot): LinkedInProfileData {
  const items = (key: SnapshotSection) => s.sections[key]?.items ?? []
  const first = (key: SnapshotSection) => items(key).map((i) => clean(i)[0]).filter((x): x is string => !!x)
  const truncated: LinkedInProfileData["truncated"] = {}
  for (const key of ["experience", "education", "certifications", "skills"] as const) {
    const t = truncation(s.sections[key])
    if (t) truncated[key] = t
  }
  return {
    name: s.name?.trim() || null,
    headline: s.headline?.trim() || null,
    about: s.about?.trim() || null,
    experience: items("experience").map(experienceItem).filter((x): x is NonNullable<typeof x> => !!x),
    education: items("education").map(educationItem).filter((x): x is NonNullable<typeof x> => !!x),
    certifications: items("certifications").map(certificationItem).filter((x): x is NonNullable<typeof x> => !!x),
    skills: first("skills"),
    languages: first("languages"),
    truncated,
  }
}
