import { analysisProfile } from "@uyarla/core/adapt/facts"
import { declarableTerms, declareTargets, type DeclarationInput, type DeclareTarget } from "@uyarla/core/adapt/declarations"
import { normalizeText } from "@uyarla/core/normalize/turkish"
import type { ResumeProfile } from "@uyarla/core/schemas/resume"

/**
 * "Bende var" (K-114). Biçim denetimi `parseAnalysisPatch`'te; burada beyanın
 * bu gereksinime ve bu CV'ye uyup uymadığı.
 */
export function checkDeclaration(
  input: DeclarationInput,
  requirement: { requirement: { type: string; concepts?: ReadonlyArray<{ term: string }> }; missingConcepts?: readonly string[] },
  profile: ResumeProfile,
): "ok" | "wrong_kind" | "unknown_term" | "unknown_target" {
  if (input.kind !== requirement.requirement.type) return "wrong_kind"
  if (input.kind === "skill") {
    // Serbest metin kabul edilmiyor: beceriye yalnızca ilanın sorduğu terim girer.
    const allowed = new Set(declarableTerms(requirement).map(normalizeText))
    return input.terms.every((term) => allowed.has(normalizeText(term))) ? "ok" : "unknown_term"
  }
  if (input.kind === "experience") {
    const { section, index } = input.target
    const entries = section === "experience" ? profile.experience : (profile.projects ?? [])
    return entries[index] ? "ok" : "unknown_target"
  }
  return "ok"
}

/**
 * Ekranın ekleme için bilmesi gerekenler. Analiz başına tek uyarlama var;
 * başladıktan sonra beyan değişirse taslaktaki maddelerle çelişir.
 */
export function declareContext(row: {
  result: unknown
  resumeVersion?: { profile: unknown } | null
  adaptation?: { id: string } | null
}): { locked: boolean; targets: DeclareTarget[] } | undefined {
  if (!row.resumeVersion) return undefined
  return {
    locked: !!row.adaptation,
    targets: declareTargets(analysisProfile(row.resumeVersion.profile as ResumeProfile, row.result)),
  }
}
