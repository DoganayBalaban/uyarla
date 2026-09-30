import { containsKeyword } from "../normalize/turkish.js"
import type { VerificationIssue } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"

/**
 * Yeniden yazımda geçip kaynakta geçmeyen ilan kavramlarını işaretler
 * (spec §7.2).
 *
 * Uydurmanın en tehlikeli biçimi budur: model, ilanın istediği şeyi CV'ye
 * yazıverir. Ve tam olarak tespit edilebilir, çünkü ilanın kavram listesi
 * elimizde (K-23).
 *
 * Karşılaştırma `containsKeyword` ile yapılıyor; Türkçe normalleştirme ve
 * çapraz dilli sözlük (K-21, K-25) böylece kendiliğinden devrede.
 */
export function checkPostingTermInjection(
  rewritten: string,
  source: string,
  posting: JobPostingData,
  /**
   * Dayanağı doğrulanmış kavram terimleri (verify/alignment.ts). Bunlar
   * kaynakta lafzen geçmese de uyarı almaz: maddede aynı şeyi anlatan bir
   * ifade olduğu kodda kanıtlandı (K-38).
   */
  allowedTerms: readonly string[] = [],
): VerificationIssue[] {
  const conceptList = posting.requirements.flatMap((r) => r.concepts)
  const warnings: VerificationIssue[] = []
  const seen = new Set<string>()
  const allowed = new Set(allowedTerms)

  for (const conceptItem of conceptList) {
    if (seen.has(conceptItem.term)) continue
    if (allowed.has(conceptItem.term)) continue

    const searchTerms = [conceptItem.term, ...conceptItem.synonyms]
    const inRewrite = searchTerms.some((t) => containsKeyword(rewritten, t))
    const presentInSource = searchTerms.some((t) => containsKeyword(source, t))

    if (inRewrite && !presentInSource) {
      seen.add(conceptItem.term)
      warnings.push({
        kind: "posting_term_injected",
        detail: `Bu maddede "${conceptItem.term}" geçiyor ama senin yazdığın hâlinde yok.`,
      })
    }
  }

  return warnings
}
