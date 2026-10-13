import type { ResumeProfile } from "../schemas/resume.js"
import type { JobQuery } from "./sources.js"

/**
 * Öneri araması: kullanıcının hedef rolü, yoksa en son unvanı, o da yoksa
 * en güçlü iki becerisi (DOG-67). Toplayıcıların arama motoru kısa sorguda
 * iyi; bütün beceri listesini göndermek sonucu daraltıp boşaltıyor.
 */
export function suggestionQuery(
  profile: ResumeProfile,
  { targetRole, city }: { targetRole?: string | null; city?: string | null },
): JobQuery {
  const role = targetRole?.trim() || profile.experience[0]?.title?.trim()
  const keywords = role || profile.skills.slice(0, 2).join(" ")
  return { keywords, location: city?.trim() || "Türkiye" }
}
