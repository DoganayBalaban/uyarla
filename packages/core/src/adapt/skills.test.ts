import { describe, it, expect } from "vitest"
import type { ScoreResult } from "../score/score.js"
import { orderSkillsForPosting } from "./skills.js"

/** Belirli becerileri kanıt gösteren sahte bir skor sonucu üretir. */
function sonuc(
  satirlar: Array<{ importance: "must" | "nice"; skill: string | null }>,
): ScoreResult {
  return {
    score: 50,
    missingKeywords: [],
    requirements: satirlar.map((s) => ({
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
  it("must karşılayan beceriyi başa alır", () => {
    expect(
      orderSkillsForPosting(
        ["Docker", "React", "Excel"],
        sonuc([{ importance: "must", skill: "React" }]),
      ),
    ).toEqual(["React", "Docker", "Excel"])
  })

  it("must'ı nice'tan önce sıralar", () => {
    expect(
      orderSkillsForPosting(
        ["Excel", "Docker", "React"],
        sonuc([
          { importance: "nice", skill: "Docker" },
          { importance: "must", skill: "React" },
        ]),
      ),
    ).toEqual(["React", "Docker", "Excel"])
  })

  it("kalan becerilerin özgün sırasını korur", () => {
    expect(
      orderSkillsForPosting(
        ["Excel", "Word", "PowerPoint", "React"],
        sonuc([{ importance: "must", skill: "React" }]),
      ),
    ).toEqual(["React", "Excel", "Word", "PowerPoint"])
  })

  it("beceri kümesini değiştirmez: eklemez, silmez", () => {
    // K-27: sıralamanın riski sıfır olmasının sebebi budur.
    const beceriler = ["Docker", "React", "Excel", "SQL"]
    const sirali = orderSkillsForPosting(
      beceriler,
      sonuc([{ importance: "must", skill: "React" }]),
    )
    expect([...sirali].sort()).toEqual([...beceriler].sort())
  })

  it("beceri olmayan kanıtları yok sayar", () => {
    // Kanıt bir deneyim maddesi ya da eğitim kaydı olabilir; sıralama
    // yalnızca beceri kanıtlarına bakar.
    const sonucBullet: ScoreResult = {
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
    expect(orderSkillsForPosting(["Docker", "React"], sonucBullet)).toEqual([
      "Docker",
      "React",
    ])
  })

  it("eşleşme yoksa sırayı bozmaz", () => {
    expect(orderSkillsForPosting(["A", "B"], sonuc([{ importance: "must", skill: null }]))).toEqual([
      "A",
      "B",
    ])
  })

  it("boş beceri listesinde boş döner", () => {
    expect(orderSkillsForPosting([], sonuc([{ importance: "must", skill: "React" }]))).toEqual([])
  })
})
