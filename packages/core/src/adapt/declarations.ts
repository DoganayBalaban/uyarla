import { z } from "zod"
import { normalizeText } from "../normalize/turkish.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { ScoreResult } from "../score/score.js"

/**
 * "Bende var" (K-114): adayın CV'ye yazmadığı ama analizde eklediği şey.
 *
 * Yalnızca o analizde kalıyor: `Analysis.result.declarations`. Olgu hafızasına
 * (K-75), CV sürümüne ya da sonraki analizlere gitmiyor. Skor ve uyarlama
 * bunu `analysisProfile` üzerinden görüyor; puan elle verilmiyor.
 */
const TargetSchema = z.object({
  section: z.enum(["experience", "projects"]),
  index: z.number().int().nonnegative(),
})

const Base = { requirementIndex: z.number().int().nonnegative(), at: z.string() }

export const DeclarationSchema = z.discriminatedUnion("kind", [
  z.object({ ...Base, kind: z.literal("skill"), terms: z.array(z.string()) }),
  z.object({ ...Base, kind: z.literal("experience"), target: TargetSchema, text: z.string() }),
  z.object({ ...Base, kind: z.literal("education"), school: z.string(), field: z.string() }),
])

export type Declaration = z.infer<typeof DeclarationSchema>

/** Kullanıcının gönderdiği kısım; gereksinim sırası ve zamanı sunucudan. */
export type DeclarationInput =
  | { kind: "skill"; terms: string[] }
  | { kind: "experience"; target: z.infer<typeof TargetSchema>; text: string }
  | { kind: "education"; school: string; field: string }

export interface DeclareTarget {
  section: "experience" | "projects"
  index: number
  label: string
}

/**
 * Beyanları profile uygular. Mevcut maddelerin yeri ve kimliği değişmiyor:
 * her şey sona ekleniyor. Profilde olmayan hedef atlanıyor.
 */
export function withDeclarations(profile: ResumeProfile, declarations: readonly Declaration[]): ResumeProfile {
  if (declarations.length === 0) return profile
  return declarations.reduce(applyDeclaration, profile)
}

function applyDeclaration(profile: ResumeProfile, declaration: Declaration): ResumeProfile {
  if (declaration.kind === "skill") {
    const present = new Set(profile.skills.map(normalizeText))
    const added = declaration.terms.filter((term) => {
      const key = normalizeText(term)
      if (present.has(key)) return false
      present.add(key)
      return true
    })
    return added.length > 0 ? { ...profile, skills: [...profile.skills, ...added] } : profile
  }
  if (declaration.kind === "education") {
    const entry = { school: declaration.school, degree: null, field: declaration.field, startDate: null, endDate: null }
    return { ...profile, education: [...profile.education, entry] }
  }
  const bullet = { text: declaration.text, sourceRef: declaration.text }
  const { section, index } = declaration.target
  if (section === "experience") {
    if (!profile.experience[index]) return profile
    return {
      ...profile,
      experience: profile.experience.map((job, i) => (i === index ? { ...job, bullets: [...job.bullets, bullet] } : job)),
    }
  }
  if (!profile.projects?.[index]) return profile
  return {
    ...profile,
    projects: profile.projects.map((project, i) => (i === index ? { ...project, bullets: [...project.bullets, bullet] } : project)),
  }
}

const MAX_TERM_LENGTH = 60
const MAX_TERM_WORDS = 5
const SENTENCE_BREAK = /[.!?;:]\s/

const OPTION_SEPARATOR = " / "

const isCleanTerm = (term: string) =>
  term.length > 0 && term.length <= MAX_TERM_LENGTH && term.split(/\s+/).length <= MAX_TERM_WORDS && !SENTENCE_BREAK.test(term)

/**
 * Bir beceri gereksiniminde adayın ekleyebileceği terimler.
 *
 * `missingConcepts` değil gereksinimin kavramları esas: süre notu ("En az 3 yıl
 * deneyim (CV'de ~1 yıl)") o listede ama kavram değil, beceri olarak yazılırsa
 * adayın eksiğini CV'sine geçirir. Seçenek grubu ("Jest / Cypress") üyelerine
 * açılıyor; tek tık bilmediği seçeneği de yazmasın. Temiz terim yoksa liste boş
 * ve düğme çıkmıyor: gereksinim cümlesi beceri olarak yazılmıyor.
 */
export function declarableTerms(item: {
  requirement: { concepts?: ReadonlyArray<{ term: string }> }
  missingConcepts?: readonly string[]
}): string[] {
  const missing = new Set(item.missingConcepts ?? [])
  const seen = new Set<string>()
  const terms: string[] = []
  for (const { term } of item.requirement.concepts ?? []) {
    if (!missing.has(term)) continue
    const members = term.split(OPTION_SEPARATOR).map((t) => t.trim())
    if (!members.every(isCleanTerm)) continue
    for (const member of members) {
      const key = normalizeText(member)
      if (seen.has(key)) continue
      seen.add(key)
      terms.push(member)
    }
  }
  return terms
}

/** Gereksinim başına bir beyan: yenisi eskisinin yerine geçiyor. */
export function upsertDeclaration(list: readonly Declaration[], next: Declaration): Declaration[] {
  return [...removeDeclaration(list, next.requirementIndex), next]
}

export function removeDeclaration(list: readonly Declaration[], requirementIndex: number): Declaration[] {
  return list.filter((d) => d.requirementIndex !== requirementIndex)
}

/** Beyandan profile giren metinler, kanıtın `matchText`'iyle karşılaştırılacak biçimde. */
function declaredTexts(declaration: Declaration): string[] {
  if (declaration.kind === "skill") return declaration.terms
  if (declaration.kind === "experience") return [declaration.text]
  return [`${declaration.school}, ${declaration.field}`]
}

/**
 * Beyandan gelen kanıtı "sen ekledin" diye işaretler. Satıra değil içeriğe
 * bakıyor: beyanlı satırın kanıtı CV'nin kendisinden olabilir, beyan edilen
 * beceri de başka bir gereksinimi karşılayabilir.
 */
export function markDeclarationEvidence(result: ScoreResult, declarations: readonly Declaration[]): ScoreResult {
  if (declarations.length === 0) return result
  const declared = new Set(declarations.flatMap(declaredTexts).map(normalizeText))
  return {
    ...result,
    requirements: result.requirements.map((r) =>
      r.evidence && declared.has(normalizeText(r.evidence.matchText)) ? { ...r, evidence: { ...r.evidence, declared: true } } : r,
    ),
  }
}

/** Deneyim cümlesinin yazılabileceği işler ve projeler. */
export function declareTargets(profile: ResumeProfile): DeclareTarget[] {
  return [
    ...profile.experience.map((job, index) => ({ section: "experience" as const, index, label: `${job.company} · ${job.title}` })),
    ...(profile.projects ?? []).map((project, index) => ({ section: "projects" as const, index, label: project.name })),
  ]
}
