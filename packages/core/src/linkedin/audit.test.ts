import { describe, expect, it } from "vitest"
import type { ScoreResult } from "../score/score.js"
import { auditProfile, compareAudits, headlineStrengths, sectionStatus, type AuditContext } from "./audit.js"
import type { ScoredPosting } from "./report.js"
import { deniz } from "./testProfile.js"

const ctx = (over: Partial<AuditContext> = {}): AuditContext => ({ targetRole: "Performance Marketing Specialist", goal: null, scored: [], ...over })
const section = (r: ReturnType<typeof auditProfile>, id: string) => r.sections.find((s) => s.id === id)!
const check = (r: ReturnType<typeof auditProfile>, id: string) => r.sections.flatMap((s) => s.checks).find((c) => c.id === id)

describe("auditProfile · başlık", () => {
  it("marks an empty headline as missing", () => {
    const r = auditProfile(deniz({ headline: null }), ctx())
    expect(section(r, "headline").status).toBe("missing")
    expect(check(r, "headline_empty")?.status).toBe("missing")
  })

  it("flags LinkedIn's default 'title at company' headline, also in English", () => {
    const r = auditProfile(deniz({ headline: "Performance Marketing Specialist at Moda Sepeti" }), ctx())
    expect(check(r, "headline_default")?.status).toBe("warn")
    const tr = auditProfile(deniz({ headline: "Performance Marketing Specialist · Moda Sepeti" }), ctx())
    expect(check(tr, "headline_default")?.status).toBe("warn")
  })

  it("checks the target role and length", () => {
    const r = auditProfile(deniz({ headline: "Pazarlama | Google Ads, GA4, Looker Studio, Meta reklamları ve e-ticaret büyümesi" }), ctx({ targetRole: "Dijital Pazarlama Uzmanı" }))
    expect(check(r, "headline_target")?.status).toBe("warn")
    expect(check(r, "headline_short")?.status).toBe("ok")
    expect(check(auditProfile(deniz({ headline: "Pazarlamacı" }), ctx()), "headline_short")?.status).toBe("warn")
  })

  it("skips target checks without a target role or postings instead of failing them", () => {
    const r = auditProfile(deniz({ headline: "Pazarlamacı" }), ctx({ targetRole: null }))
    expect(check(r, "headline_target")).toBeUndefined()
    expect(r.skipped).toContain("headline_target")
    const counted = r.sections.flatMap((s) => s.checks).length
    expect(r.summary.total).toBe(counted)
  })
})

describe("auditProfile · hakkında", () => {
  it("missing, short, hook and clichés", () => {
    expect(section(auditProfile(deniz({ about: null }), ctx()), "about").status).toBe("missing")
    expect(check(auditProfile(deniz(), ctx()), "about_short")?.status).toBe("warn")
    const long = `Performance Marketing Specialist olarak ${"e-ticaret markalarında kampanya yönetiyorum ".repeat(10)}`
    const r = auditProfile(deniz({ about: long }), ctx())
    expect(check(r, "about_short")?.status).toBe("ok")
    expect(check(r, "about_hook")?.status).toBe("ok")
    const cliche = auditProfile(deniz({ about: `${long} Takım oyuncusuyum ve stres altında çalışabilirim.` }), ctx())
    expect(check(cliche, "about_cliche")?.status).toBe("warn")
  })

  it("does not call an English about text a cliché by Turkish rules", () => {
    const en = `I am a performance marketing specialist managing Meta and Google campaigns for e-commerce brands. ${"I report results weekly with GA4 dashboards. ".repeat(6)}`
    expect(check(auditProfile(deniz({ about: en }), ctx()), "about_cliche")?.status).toBe("ok")
  })
})

describe("auditProfile · deneyim, eğitim, beceriler", () => {
  it("checks each role: description, measurable result, dates", () => {
    const r = auditProfile(
      deniz({
        experience: [
          { title: "Uzman", company: "Acme", dateRange: "2022 - Present", location: null, description: "Kampanya yönettim ve raporladım." },
          { title: "Asistan", company: "Beta", dateRange: null, location: null, description: null },
        ],
      }),
      ctx(),
    )
    const checks = section(r, "experience").checks
    expect(checks.find((c) => c.id === "exp_no_measurable" && c.role === 0)?.status).toBe("warn")
    expect(checks.find((c) => c.id === "exp_description_missing" && c.role === 1)?.status).toBe("warn")
    expect(checks.find((c) => c.id === "exp_dates_missing" && c.role === 1)?.status).toBe("warn")
    expect(section(r, "experience").status).toBe("improve")
    expect(section(auditProfile(deniz({ experience: [] }), ctx()), "experience").status).toBe("missing")
  })

  it("education: missing, and a project hint for a first job seeker", () => {
    expect(section(auditProfile(deniz({ education: [] }), ctx()), "education").status).toBe("missing")
    expect(check(auditProfile(deniz(), ctx({ goal: "first_job" })), "education_first_job")?.status).toBe("warn")
    expect(check(auditProfile(deniz(), ctx()), "education_first_job")).toBeUndefined()
  })

  it("certifications are informational", () => {
    expect(section(auditProfile(deniz(), ctx()), "certifications")).toMatchObject({ status: "info", checks: [] })
  })

  it("skills: few, and evidenced concepts missing from the list", () => {
    const posting: ScoredPosting = {
      analysisId: "a1",
      position: "Dijital Pazarlama Uzmanı",
      company: null,
      result: {
        score: 40,
        requirements: [
          { requirement: { text: "GA4", type: "skill", importance: "must", concepts: [] }, status: "matched", matchedConcepts: ["GA4"], missingConcepts: [] },
          { requirement: { text: "Excel", type: "skill", importance: "must", concepts: [] }, status: "missing", matchedConcepts: [], missingConcepts: ["Excel"] },
        ],
        missingKeywords: ["Excel"],
      } as unknown as ScoreResult,
    }
    const r = auditProfile(deniz(), ctx({ scored: [posting] }))
    expect(check(r, "skills_few")?.status).toBe("warn")
    expect(check(r, "skills_evidenced_missing")?.status).toBe("warn")
    expect(r.skills.add).toEqual([{ term: "GA4", evidence: "GA4 panoları hazırladım." }])
    expect(section(r, "postings").status).toBe("improve")
    expect(r.commonMissing.map((m) => m.term)).toEqual(["Excel"])
  })
})

describe("sectionStatus, summary, compareAudits", () => {
  it("worst check decides the section", () => {
    expect(sectionStatus([{ id: "about_short", status: "ok", text: "" }])).toBe("strong")
    expect(sectionStatus([{ id: "about_short", status: "warn", text: "" }])).toBe("improve")
    expect(sectionStatus([{ id: "about_missing", status: "missing", text: "" }, { id: "about_short", status: "ok", text: "" }])).toBe("missing")
  })

  it("summary counts passed checks", () => {
    const r = auditProfile(deniz(), ctx())
    const all = r.sections.flatMap((s) => s.checks)
    expect(r.summary).toEqual({ passed: all.filter((c) => c.status === "ok").length, total: all.length })
  })

  it("compares two audits", () => {
    const before = auditProfile(deniz({ headline: null }), ctx())
    const after = auditProfile(deniz({ headline: "Performance Marketing Specialist | Google Ads, GA4, Looker Studio, e-ticaret büyümesi" }), ctx())
    const diff = compareAudits(before, after)!
    expect(diff.improved).toContain("headline")
    expect(diff.passedDelta).toBeGreaterThan(0)
    expect(compareAudits(null, after)).toBeNull()
  })
})

describe("auditProfile · son inceleme (DOG-157)", () => {
  it("flags LinkedIn's Turkish default headline ('Şirket şirketinde Unvan')", () => {
    const r = auditProfile(deniz({ headline: "Moda Sepeti şirketinde Performance Marketing Specialist" }), ctx())
    expect(check(r, "headline_default")?.status).toBe("warn")
  })

  it("counts skills from the 'show all' total when the page shows only the top ones", () => {
    const r = auditProfile(deniz({ skills: ["Google Ads", "GA4"], truncated: { skills: { shown: 2, total: 25 } } }), ctx())
    expect(check(r, "skills_few")).toMatchObject({ status: "ok", text: "Profilinde 25 beceri var." })
  })

  it("skips the skill count when the full list is unknown and the read part is short (PDF's top skills)", () => {
    const r = auditProfile(deniz({ skills: ["Google Ads", "GA4", "SQL"], truncated: { skills: { shown: 3, total: null } } }), ctx())
    expect(check(r, "skills_few")).toBeUndefined()
    expect(r.skipped).toContain("skills_few")
    const many = auditProfile(deniz({ skills: ["A1", "B2", "C3", "D4", "E5", "F6"], truncated: { skills: { shown: 6, total: null } } }), ctx())
    expect(check(many, "skills_few")).toMatchObject({ status: "ok", text: "Profilinde en az 6 beceri var." })
  })

  it("says 'add if it is not in your full list' when only part of the skill list was read", () => {
    const posting = {
      analysisId: "a1",
      position: "Dijital Pazarlama Uzmanı",
      company: null,
      result: {
        score: 40,
        requirements: [{ requirement: { text: "GA4", type: "skill", importance: "must", concepts: [] }, status: "matched", matchedConcepts: ["GA4"], missingConcepts: [] }],
        missingKeywords: [],
      } as unknown as ScoreResult,
    }
    const r = auditProfile(deniz({ truncated: { skills: { shown: 2, total: 12 } } }), ctx({ scored: [posting] }))
    expect(check(r, "skills_evidenced_missing")?.text).toContain("tam listende yoksa ekle")
  })

  it("fixing a role's dates or adding a project to education raises the passed count", () => {
    const role = deniz().experience[0]!
    const before = auditProfile(deniz({ experience: [{ ...role, dateRange: null }] }), ctx())
    const after = auditProfile(deniz(), ctx())
    expect(after.summary.passed - before.summary.passed).toBe(1)
    expect(after.summary.total).toBe(before.summary.total)

    const school = deniz().education[0]!
    const noProject = auditProfile(deniz(), ctx({ goal: "first_job" }))
    const project = auditProfile(deniz({ education: [{ ...school, description: "Bitirme projesi: e-ticaret kampanya analizi" }] }), ctx({ goal: "first_job" }))
    expect(project.summary.passed - noProject.summary.passed).toBe(1)
    expect(project.summary.total).toBe(noProject.summary.total)
  })

  it("gives the headline writer the profile's own skills even without postings", () => {
    const r = auditProfile(deniz(), ctx({ targetRole: null }))
    expect(r.skills.pinFirst).toEqual([])
    expect(headlineStrengths(r, deniz())).toEqual(["Google Ads", "Looker Studio"])
  })
})
