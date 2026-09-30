import { describe, it, expect } from "vitest"
import type { ScoreResult } from "../score/score.js"
import { orderSkillsForPosting } from "./skills.js"

/** Belirli becerileri kanıt gösteren sahte bir skor sonucu üretir. */
function outcome(
  lineItems: Array<{ importance: "must" | "nice"; skill: string | null }>,
): ScoreResult {
  return {
    score: 50,
    missingKeywords: [],
    requirements: lineItems.map((s) => ({
      requirement: { text: "g", type: "skill", importance: s.importance, concepts: [] },
      status: s.skill ? "matched" : "missing",
      confidence: s.skill ? 1 : 0,
      method: s.skill ? "keyword" : null,
      evidence: s.skill
        ? { text: s.skill, matchText: s.skill, kind: "skill" as const, sourceRef: null }
        : null,
      matchedConcepts: [],
      missingConcepts: [],
    })),
  }
}

describe("orderSkillsForPosting", () => {
  it("moves a skill satisfying a must requirement to the front", () => {
    expect(
      orderSkillsForPosting(
        ["Docker", "React", "Excel"],
        outcome([{ importance: "must", skill: "React" }]),
      ),
    ).toEqual(["React", "Docker", "Excel"])
  })

  it("orders must before nice", () => {
    expect(
      orderSkillsForPosting(
        ["Excel", "Docker", "React"],
        outcome([
          { importance: "nice", skill: "Docker" },
          { importance: "must", skill: "React" },
        ]),
      ),
    ).toEqual(["React", "Docker", "Excel"])
  })

  it("keeps the original order of the remaining skills", () => {
    expect(
      orderSkillsForPosting(
        ["Excel", "Word", "PowerPoint", "React"],
        outcome([{ importance: "must", skill: "React" }]),
      ),
    ).toEqual(["React", "Excel", "Word", "PowerPoint"])
  })

  it("does not change the skill set: adds nothing, removes nothing", () => {
    // K-27: sıralamanın riski sıfır olmasının sebebi budur.
    const skillList = ["Docker", "React", "Excel", "SQL"]
    const sorted = orderSkillsForPosting(
      skillList,
      outcome([{ importance: "must", skill: "React" }]),
    )
    expect([...sorted].sort()).toEqual([...skillList].sort())
  })

  it("ignores non-skill evidence", () => {
    // Kanıt bir deneyim maddesi ya da eğitim kaydı olabilir; sıralama
    // yalnızca beceri kanıtlarına bakar.
    const resultBullet: ScoreResult = {
      score: 50,
      missingKeywords: [],
      requirements: [
        {
          requirement: { text: "g", type: "skill", importance: "must", concepts: [] },
          status: "matched",
          confidence: 1,
          method: "keyword",
          evidence: {
            text: "Acme: React ile panel geliştirdim",
            matchText: "React ile panel geliştirdim",
            kind: "bullet",
            sourceRef: "React ile panel geliştirdim",
          },
          matchedConcepts: [],
          missingConcepts: [],
        },
      ],
    }
    expect(orderSkillsForPosting(["Docker", "React"], resultBullet)).toEqual([
      "Docker",
      "React",
    ])
  })

  it("keeps order when nothing matches", () => {
    expect(orderSkillsForPosting(["A", "B"], outcome([{ importance: "must", skill: null }]))).toEqual([
      "A",
      "B",
    ])
  })

  it("returns empty for an empty skill list", () => {
    expect(orderSkillsForPosting([], outcome([{ importance: "must", skill: "React" }]))).toEqual([])
  })
})
