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
): VerificationIssue[] {
  const kavramlar = posting.requirements.flatMap((r) => r.concepts)
  const uyarilar: VerificationIssue[] = []
  const gorulen = new Set<string>()

  for (const kavram of kavramlar) {
    if (gorulen.has(kavram.term)) continue

    const aranacaklar = [kavram.term, ...kavram.synonyms]
    const yazimdaVar = aranacaklar.some((t) => containsKeyword(rewritten, t))
    const kaynaktaVar = aranacaklar.some((t) => containsKeyword(source, t))

    if (yazimdaVar && !kaynaktaVar) {
      gorulen.add(kavram.term)
      uyarilar.push({
        kind: "posting_term_injected",
        detail: `Bu maddede "${kavram.term}" geçiyor ama senin yazdığın hâlinde yok.`,
      })
    }
  }

  return uyarilar
}
