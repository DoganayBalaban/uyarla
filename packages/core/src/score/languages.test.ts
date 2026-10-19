import { describe, expect, it } from "vitest"
import type { Requirement } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { checkLanguages } from "./languages.js"

const skill = (text: string): Requirement => ({ text, importance: "must", type: "skill", concepts: [{ term: text, synonyms: [] }] })

const profile = (languages: string[], skills: string[] = []): ResumeProfile => ({
  fullName: null,
  headline: null,
  summary: null,
  experience: [],
  education: [],
  skills,
  languages,
  certifications: [],
})

describe("checkLanguages", () => {
  it("flags a CV level below the requested one", () => {
    const [check] = checkLanguages([skill("Fluent English (C1)")], profile(["İngilizce (B1)"]))
    expect(check).toMatchObject({ index: 0, language: "İngilizce", required: "C1", found: "B1", status: "below" })
  })

  it("reads Turkish level words, including the capital İ", () => {
    const [check] = checkLanguages([skill("İyi derecede İngilizce bilgisi")], profile(["İngilizce - İleri"]))
    expect(check).toMatchObject({ required: "B2", found: "C1", status: "ok" })
  })

  it("reads LinkedIn proficiency buckets", () => {
    const [check] = checkLanguages(
      [skill("Advanced English")],
      profile(["English (Professional Working Proficiency)"]),
    )
    expect(check).toMatchObject({ required: "C1", found: "B2", status: "below" })
    const [native] = checkLanguages([skill("Native Turkish")], profile(["Türkçe (Ana dil)"]))
    expect(native!.status).toBe("ok")
  })

  it("marks unknown when the CV gives no level and absent when the language is missing", () => {
    expect(checkLanguages([skill("Akıcı Almanca")], profile(["Almanca"]))[0]!.status).toBe("unknown")
    expect(checkLanguages([skill("Akıcı Almanca")], profile(["İngilizce (C1)"]))[0]!.status).toBe("absent")
  })

  it("falls back to the skills list", () => {
    expect(checkLanguages([skill("English B2")], profile([], ["English (C1)"]))[0]!.status).toBe("ok")
  })

  it("skips requirements without a level or with several languages", () => {
    const checks = checkLanguages(
      [skill("İngilizce bilgisi"), skill("İngilizce C1, Almanca tercih sebebi"), skill("B2B satış deneyimi")],
      profile(["İngilizce (B1)"]),
    )
    expect(checks).toEqual([])
  })

  it("does not read level words inside other words", () => {
    // "iyileştirme" bir seviye değil.
    expect(checkLanguages([skill("İngilizce dokümantasyonu iyileştirme")], profile(["İngilizce"]))).toEqual([])
  })
})
