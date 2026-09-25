import { normalizeText } from "../normalize/turkish.js"
import type { ScoreResult } from "../score/score.js"

/**
 * Becerileri ilana göre sıralar.
 *
 * Küme değişmez: hiçbir beceri eklenmez, hiçbiri silinmez. Bu yüzden uydurma
 * riski sıfırdır ve doğrulamaya tabi değildir (K-27).
 *
 * Sıra: önce `must` gereksinimi karşılayanlar, sonra `nice` karşılayanlar,
 * sonra kalanlar özgün sıralarıyla. ATS tarayıcıları listenin başındaki
 * terimleri daha çok tarttığı için sıralama gerçek bir kazanç.
 *
 * LLM gerektirmiyor: skor servisi hangi becerinin hangi gereksinimi
 * karşıladığını `evidence` alanında zaten söylüyor.
 */
export function orderSkillsForPosting(
  skills: string[],
  result: ScoreResult,
): string[] {
  const must = new Set<string>()
  const nice = new Set<string>()

  for (const r of result.requirements) {
    if (r.status !== "matched" || r.evidence?.kind !== "skill") continue
    const anahtar = normalizeText(r.evidence.text)
    if (r.requirement.importance === "must") must.add(anahtar)
    else nice.add(anahtar)
  }

  const oncelik = (beceri: string): number => {
    const anahtar = normalizeText(beceri)
    if (must.has(anahtar)) return 0
    if (nice.has(anahtar)) return 1
    return 2
  }

  // Kararlı sıralama: aynı önceliktekiler özgün sıralarını korur.
  return skills
    .map((beceri, i) => ({ beceri, i, oncelik: oncelik(beceri) }))
    .sort((a, b) => a.oncelik - b.oncelik || a.i - b.i)
    .map((x) => x.beceri)
}
