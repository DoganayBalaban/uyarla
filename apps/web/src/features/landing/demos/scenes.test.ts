import { describe, expect, it } from "vitest"
import { DEMO_BULLETS, DEMO_REQUIREMENTS } from "@/features/landing/demos/demoScript"
import { APPLY_SCENE, BOARD_SCENE, ELIF_CV, INTERVIEW_SCENE, JOB_SCENE, LINKEDIN_SCENE, SCENE_ROLE, inCv } from "@/features/landing/demos/scenes"

/** Sahnelerin örnek verisi uydurma kuralına uyuyor mu (spec §6). */
describe("Elif's sample CV", () => {
  it("contains the original wording of every adapted bullet", () => {
    for (const b of DEMO_BULLETS) {
      const original = b.segments.filter((x) => x.kind !== "add").map((x) => x.text).join("").trim()
      expect(inCv(original), original).toBe(true)
    }
  })

  it("matches quotes exactly, not loosely", () => {
    expect(inCv("Kod incelemelerine katıldım")).toBe(true)
    expect(inCv("kod incelemelerine katıldım")).toBe(false)
    expect(ELIF_CV).not.toContain("12 geliştirici")
  })
})

describe("job search scene", () => {
  it("uses the product's own links and notes, and shows no result counts", () => {
    expect(JOB_SCENE.links.map((l) => l.label)).toEqual(["Kariyer.net", "LinkedIn", "Jooble", "Careerjet"])
    expect(JOB_SCENE.links.find((l) => l.site === "linkedin")!.note).toBe("İstanbul, Türkiye")
    expect(JOB_SCENE.links.find((l) => l.site === "kariyernet")!.note).toBe("Şehri sitede seçersin")
    expect(JSON.stringify(JOB_SCENE)).not.toMatch(/\d+ (ilan|sonuç)/)
  })
})

describe("apply scene", () => {
  it("keeps the answer within its limit and every claim in the CV", () => {
    expect(APPLY_SCENE.answer.length).toBeLessThanOrEqual(APPLY_SCENE.limit)
    expect(APPLY_SCENE.limit).toBe(140)
    for (const q of [...APPLY_SCENE.answerEvidence, APPLY_SCENE.letterEvidence]) expect(inCv(q), q).toBe(true)
  })
})

describe("board scene", () => {
  it("takes the gate count and scores from the existing demo story", () => {
    const missingMust = DEMO_REQUIREMENTS.filter((r) => r.importance === "Zorunlu" && !r.evidence).length
    expect(BOARD_SCENE.missingMust).toBe(missingMust)
    expect(BOARD_SCENE.before).toBe(28)
    expect(BOARD_SCENE.after).toBe(41)
    expect(BOARD_SCENE.note).toContain("[ad]")
  })
})

describe("interview scene", () => {
  it("grounds the question in the CV and flags a claim that is not on paper", () => {
    expect(inCv(INTERVIEW_SCENE.evidence)).toBe(true)
    expect(INTERVIEW_SCENE.answer).toContain(INTERVIEW_SCENE.notOnPaper)
    expect(inCv(INTERVIEW_SCENE.notOnPaper)).toBe(false)
    expect(INTERVIEW_SCENE.star.map((x) => x.label)).toEqual(["Durum", "Görev", "Eylem", "Sonuç"])
  })
})

describe("linkedin scene", () => {
  it("builds the new headline only from the target role and the CV", () => {
    for (const p of LINKEDIN_SCENE.parts) {
      if (p.source.kind === "profile") expect(inCv(p.source.quote), p.source.quote).toBe(true)
      else expect(p.text).toBe(SCENE_ROLE)
    }
  })
})

describe("existing demo data against the sample CV (son inceleme)", () => {
  it("quotes every requirement's evidence from the CV and keeps the missing ones truly missing", () => {
    for (const r of DEMO_REQUIREMENTS) {
      if (r.evidence) expect(inCv(r.evidence.quote), r.evidence.quote).toBe(true)
      for (const term of (r.why ?? "").match(/“([^”]+)”/g) ?? []) {
        const t = term.slice(1, -1)
        expect(ELIF_CV.toLocaleLowerCase("tr").includes(t.toLocaleLowerCase("tr")), t).toBe(false)
      }
    }
  })

  it("answers the form with the CV's own wording", () => {
    for (const q of APPLY_SCENE.answerEvidence) expect(APPLY_SCENE.answer, q).toContain(q)
    expect(APPLY_SCENE.letter.toLocaleLowerCase("tr")).toContain(APPLY_SCENE.letterEvidence.toLocaleLowerCase("tr"))
  })
})
