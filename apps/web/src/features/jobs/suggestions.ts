import type { ResumeProfile } from "@uyarla/core/schemas/resume"

/**
 * İş ara sayfasının öneri rozetleri (DOG-150). Roller aramanın yerine geçiyor
 * (hedef rol, son unvanlar); eklenecekler aramanın sonuna ekleniyor
 * (güçlü beceriler). Aynı terim iki kez çıkmıyor, Türkçe büyük/küçük harf
 * farkı yok sayılıyor.
 */
export const ROLE_LIMIT = 3
export const SKILL_LIMIT = 5

const key = (s: string) => s.trim().toLocaleLowerCase("tr-TR")

function unique(list: Array<string | null | undefined>, limit: number, skip: Set<string> = new Set()): string[] {
  const seen = new Set(skip)
  const out: string[] = []
  for (const raw of list) {
    const value = raw?.trim()
    if (!value || seen.has(key(value))) continue
    seen.add(key(value))
    out.push(value)
    if (out.length === limit) break
  }
  return out
}

export function searchSuggestions(
  profile: Pick<ResumeProfile, "experience" | "skills">,
  targetRole: string | null,
): { roles: string[]; skills: string[] } {
  const roles = unique([targetRole, ...profile.experience.map((e) => e.title)], ROLE_LIMIT)
  const skills = unique(profile.skills, SKILL_LIMIT, new Set(roles.map(key)))
  return { roles, skills }
}

/** Terimi aramaya ekler; zaten varsa olduğu gibi bırakır. */
export function addTerm(keywords: string, term: string): string {
  const current = keywords.trim()
  if (!current) return term
  return key(current).split(/\s+/).includes(key(term)) || key(current).includes(key(term)) ? current : `${current} ${term}`
}
