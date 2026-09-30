import { containsKeyword, normalizeText } from "../normalize/turkish.js"
import type { Concept } from "../schemas/job.js"
import { isProperNoun } from "../score/score.js"
import type { TermAlignment } from "../schemas/adaptation.js"

export interface AlignmentConfig {
  /** Terim ile dayanak arasında aranan en düşük anlamsal benzerlik. */
  minSimilarity: number
}

/**
 * Yalnızca kaba bir emniyet. Ölçümde gömme benzerliği dürüst uyumu zorlama
 * bağdan ayıramadı: "Web performansı" ↔ "sayfa yüklenme süresini %40
 * azalttım" 0,53, "tasarım sistemi" ↔ "Figma tasarımlarını" 0,57 (zorlama).
 * Bu yüzden son söz kullanıcıda: terim uyumu taşıyan madde onay bekliyor
 * (adapt/draft.ts).
 */
export const DEFAULT_ALIGNMENT_CONFIG: AlignmentConfig = {
  minSimilarity: 0.5,
}

/**
 * Modelin bildirdiği terim-dayanak eşlemelerinden doğrulananları döndürür.
 *
 * Üç koşul, üçü de kodda:
 *   1. Terim, bu maddeye önerilen hedeflerden birine ait. Model listede
 *      olmayan bir ilan terimi getirdiyse uyum sayılmaz.
 *   2. Dayanak, kaynak maddede birebir geçiyor (Türkçe normalleştirmeyle).
 *   3. Terim ile dayanak anlamca yakın: model "Kubernetes" için "dağıtım
 *      yaptım" dayanağını gösterirse bu geçmez.
 *
 * Yargı modele bırakılmıyor (K-28): model yalnızca iddia ediyor, doğrulama
 * deterministik.
 */
export function verifyAlignments(
  input: {
    alignments: TermAlignment[]
    source: string
    targets: Concept[]
    /** Her eşleme için terim-dayanak benzerliği, aynı sırada. */
    similarities: number[]
  },
  cfg: AlignmentConfig = DEFAULT_ALIGNMENT_CONFIG,
): Array<TermAlignment & { concept: Concept }> {
  const verified: Array<TermAlignment & { concept: Concept }> = []

  input.alignments.forEach((a, i) => {
    const concept = input.targets.find((c) =>
      [c.term, ...c.synonyms].some(
        (t) => containsKeyword(a.term, t) || containsKeyword(t, a.term),
      ),
    )
    if (!concept) return
    // Özel ad hiçbir dayanakla hizalanamaz; hedef seçimi de onları
    // vermiyor, bu ikinci emniyet (bkz. adapt/targets.ts).
    if (isProperNoun(concept)) return
    if (!basisValid(a.basis, input.source)) return
    if ((input.similarities[i] ?? 0) < cfg.minSimilarity) return
    verified.push({ ...a, concept })
  })

  return verified
}

/**
 * Dayanak kaynakta geçmeli ve tek başına anlam taşımalı: "ve", "ile" gibi
 * bir bağlaç her maddede geçer ve dayanak olamaz.
 */
function basisValid(basisText: string, sourceText: string): boolean {
  const n = normalizeText(basisText)
  if (n.length < 3 || !/\p{L}{3,}/u.test(n)) return false
  return containsKeyword(sourceText, basisText)
}
