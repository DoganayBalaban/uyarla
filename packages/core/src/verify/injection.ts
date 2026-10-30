import { containsKeyword, normalizeTokens } from "../normalize/turkish.js"
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
  const sourceTokens = normalizeTokens(source)

  for (const conceptItem of conceptList) {
    if (seen.has(conceptItem.term)) continue
    if (allowed.has(conceptItem.term)) continue

    const searchTerms = [conceptItem.term, ...conceptItem.synonyms]
    const inRewrite = searchTerms.some((t) => containsKeyword(rewritten, t))
    const presentInSource = searchTerms.some((t) => containsKeyword(source, t) || containsRootOf(sourceTokens, t))

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

/** "-lama/-leme" ile türemiş ad: "raporlama" ← "rapor". */
const VERBAL_NOUN = /^(.{5,})l[ae]m[ae]$/u

/**
 * Terim kaynakta kökünden geçiyor mu (DOG-166): CV'de "raporları sundum"
 * varken "raporlama" uydurma sayılıyordu. Yalnızca "-lama/-leme" türetmesi
 * ve en az beş harfli kök; çok kelimeli terimde kelimeler ardışık. Bedeli:
 * "pazar" ile "pazarlama" da aynı kök sayılıyor; bu bir hatırlatma listesi.
 */
function containsRootOf(sourceTokens: string[], term: string): boolean {
  const termTokens = normalizeTokens(term)
  if (termTokens.length === 0) return false
  const matches = (k: string, m: string) => {
    if (k === m) return true
    const root = k.match(VERBAL_NOUN)?.[1]
    return !!root && (m === root || m.startsWith(`${root}l`))
  }
  for (let i = 0; i + termTokens.length <= sourceTokens.length; i++) {
    if (termTokens.every((k, j) => matches(k, sourceTokens[i + j]!))) return true
  }
  return false
}
