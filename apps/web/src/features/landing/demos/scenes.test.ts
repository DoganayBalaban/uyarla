import { describe, expect, it } from "vitest"
import { DEMO_BULLETS } from "@/features/landing/demos/demoScript"
import { ELIF_CV, JOB_SCENE, inCv } from "@/features/landing/demos/scenes"

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
