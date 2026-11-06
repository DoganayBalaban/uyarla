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

/** Gereksinim başına bir beyan: yenisi eskisinin yerine geçiyor. */
export function upsertDeclaration(list: readonly Declaration[], next: Declaration): Declaration[] {
  return [...removeDeclaration(list, next.requirementIndex), next]
}

export function removeDeclaration(list: readonly Declaration[], requirementIndex: number): Declaration[] {
  return list.filter((d) => d.requirementIndex !== requirementIndex)
}

/** Beyanın kendi gereksinimi karşılandıysa kanıtı "sen ekledin" diye işaretler. */
export function markDeclarationEvidence(result: ScoreResult, declarations: readonly Declaration[]): ScoreResult {
  if (declarations.length === 0) return result
  const declared = new Set(declarations.map((d) => d.requirementIndex))
  return {
    ...result,
    requirements: result.requirements.map((r, i) =>
      declared.has(i) && r.evidence ? { ...r, evidence: { ...r.evidence, declared: true } } : r,
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
