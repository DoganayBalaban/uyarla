import { containsKeyword } from "../normalize/turkish.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { ScoreResult } from "../score/score.js"
import type { LinkedInCheck, LinkedInReport } from "./reportRecord.js"

export * from "./reportRecord.js"

/**
 * LinkedIn profil raporu (DOG-69). Girdi kullanıcının LinkedIn'den indirdiği
 * PDF (DOG-60'tan beri doğru okunuyor) ve daha önce analiz ettiği 1–3 ilan;
 * profil sayfası sunucudan çekilmiyor (kazıma, DOG-67). LLM yok: kontroller
 * ve ortak eksikler kodda. Profile dokunmuyoruz; kullanıcı kendisi günceller.
 *
 * Kontrollerin eşikleri yönlendirme, LinkedIn kuralı değil: "Hakkında" 40
 * kelimenin altında "kısa", 5'ten az beceri "az" sayılıyor.
 */
export const ABOUT_MIN_WORDS = 40
export const SKILLS_MIN = 5

export interface ScoredPosting {
  analysisId: string
  position: string
  company: string | null
  result: ScoreResult
  /** Kullanıcının "ilanda yok" dediği gereksinimler (DOG-90). */
  excluded?: readonly number[]
}

const words = (text: string | null | undefined) => (text ?? "").split(/\s+/).filter(Boolean).length

export function linkedinReport(profile: ResumeProfile, scored: readonly ScoredPosting[], options: { targetRole?: string | null } = {}): LinkedInReport {
  // Ortak eksikler: kavram bazında, ilan başına bir kez sayılıyor.
  const byTerm = new Map<string, { term: string; postings: Set<string>; must: boolean }>()
  for (const s of scored) {
    const excluded = new Set(s.excluded ?? [])
    s.result.requirements.forEach((r, i) => {
      if (excluded.has(i) || r.requirement.type === "condition" || r.requirement.type === "soft") return
      for (const term of r.missingConcepts ?? []) {
        const key = term.toLocaleLowerCase("tr")
        const entry = byTerm.get(key) ?? { term, postings: new Set<string>(), must: false }
        entry.postings.add(s.analysisId)
        entry.must ||= r.requirement.importance === "must"
        byTerm.set(key, entry)
      }
    })
  }
  const threshold = scored.length >= 2 ? 2 : 1
  const commonMissing = [...byTerm.values()]
    .filter((e) => e.postings.size >= threshold)
    .map((e) => ({ term: e.term, postings: e.postings.size, must: e.must }))
    .sort((a, b) => b.postings - a.postings || Number(b.must) - Number(a.must) || a.term.localeCompare(b.term, "tr"))

  const headline = profile.headline?.trim() || null
  const about = profile.summary?.trim() || null
  // Hedef rol yoksa seçilen ilanların unvanları; "A / B" biçimindekiler ayrı ayrı.
  const targets = options.targetRole?.trim()
    ? [options.targetRole.trim()]
    : [...new Set(scored.flatMap((s) => s.position.split(/\s*[/|]\s*/)).map((t) => t.trim()).filter(Boolean))]
  const checks: LinkedInCheck[] = []

  if (!headline) {
    checks.push({ id: "headline_empty", status: "warn", text: "Başlığın boş görünüyor. Hedef unvanını ve en güçlü 2–3 becerini yaz." })
  } else {
    if (targets.length > 0) {
      const hit = targets.find((t) => containsKeyword(headline, t))
      const shown = targets.slice(0, 3).map((t) => `“${t}”`).join(", ")
      checks.push({
        id: "headline_target",
        status: hit ? "ok" : "warn",
        text: hit
          ? `Başlığında hedef unvan (“${hit}”) geçiyor.`
          : `Başlığında hedeflediğin unvan geçmiyor (${shown}); işe alımcılar unvanla arıyor.`,
      })
    }
    // Yalnızca son unvan ya da iki-üç kelime: beceri ve alan yok.
    const lastTitle = profile.experience[0]?.title?.trim()
    const generic = words(headline) <= 3 || (!!lastTitle && headline.toLocaleLowerCase("tr") === lastTitle.toLocaleLowerCase("tr"))
    checks.push({
      id: "headline_generic",
      status: generic ? "warn" : "ok",
      text: generic ? "Başlığın yalnızca unvan; unvanının yanına 2–3 güçlü becerini ekleyebilirsin." : "Başlığında unvanın yanında beceri ya da alan var.",
    })
  }

  if (!about) {
    checks.push({ id: "about_missing", status: "warn", text: "“Hakkında” bölümü boş görünüyor. Deneyimini ve hedefini birkaç cümleyle anlat." })
  } else {
    const short = words(about) < ABOUT_MIN_WORDS
    checks.push({
      id: "about_short",
      status: short ? "warn" : "ok",
      text: short ? `“Hakkında” bölümün ${words(about)} kelime; en az ${ABOUT_MIN_WORDS} kelimeyle bir somut başarını da yaz.` : "“Hakkında” bölümün dolu.",
    })
  }

  const few = profile.skills.length < SKILLS_MIN
  checks.push({
    id: "skills_few",
    status: few ? "warn" : "ok",
    text: few ? `Profilinde ${profile.skills.length} beceri görünüyor; deneyiminde olanları ekle.` : `Profilinde ${profile.skills.length} beceri var.`,
  })

  return {
    postings: scored.map((s) => ({ analysisId: s.analysisId, position: s.position, company: s.company, score: s.result.score })),
    commonMissing,
    checks,
    headline,
    about,
  }
}
