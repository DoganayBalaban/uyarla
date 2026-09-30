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
    const key = normalizeText(r.evidence.text)
    if (r.requirement.importance === "must") must.add(key)
    else nice.add(key)
  }

  const priority = (skill: string): number => {
    const key = normalizeText(skill)
    if (must.has(key)) return 0
    if (nice.has(key)) return 1
    return 2
  }

  // Kararlı sıralama: aynı önceliktekiler özgün sıralarını korur.
  return skills
    .map((skill, i) => ({ skill, i, priority: priority(skill) }))
    .sort((a, b) => a.priority - b.priority || a.i - b.i)
    .map((x) => x.skill)
}
