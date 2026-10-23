import { describe, expect, it } from "vitest"
import type { LinkedInRewrites } from "@uyarla/core/linkedin/rewrite"
import { auditRequestSchema, isStuck, lockRewrites, presentedStatus } from "@/features/linkedin/audit"

const ok = { status: "ok" as const, issues: [] }
const rewrites: LinkedInRewrites = {
  headline: { status: "done", options: [{ text: "Uzman | Google Ads", verification: ok }] },
  about: { status: "done", suggestion: { text: "GİZLİ-HAKKINDA-METNİ", verification: ok } },
  experience: [
    { index: 0, status: "done", suggestion: { text: "GİZLİ-DENEYİM-METNİ", verification: ok } },
    { index: 1, status: "template", text: "• [şablon]" },
  ],
}

describe("lockRewrites", () => {
  it("strips about and experience rewrites without a pass, everywhere in the JSON", () => {
    const { rewrites: shown, locked } = lockRewrites(rewrites, false)
    const json = JSON.stringify(shown)
    expect(json).not.toContain("GİZLİ-HAKKINDA-METNİ")
    expect(json).not.toContain("GİZLİ-DENEYİM-METNİ")
    expect(shown.headline).toEqual(rewrites.headline)
    expect(shown.experience[1]).toEqual(rewrites.experience[1])
    expect(locked).toEqual({ about: true, experience: 1 })
  })

  it("passes everything through with a pass", () => {
    expect(lockRewrites(rewrites, true)).toEqual({ rewrites, locked: null })
  })
})

describe("auditRequestSchema", () => {
  const profile = { name: null, headline: "Başlık", about: null, experience: [], education: [], certifications: [], skills: [], languages: [], truncated: {} }

  it("accepts the two sources", () => {
    expect(auditRequestSchema.safeParse({ source: "extension", profile, targetRole: null, analysisIds: [] }).success).toBe(true)
    expect(auditRequestSchema.safeParse({ source: "pdf", resumeId: "r1", targetRole: "Uzman", analysisIds: ["a1"] }).success).toBe(true)
  })

  it("rejects more than three postings and a broken profile", () => {
    expect(auditRequestSchema.safeParse({ source: "pdf", resumeId: "r1", targetRole: null, analysisIds: ["a", "b", "c", "d"] }).success).toBe(false)
    expect(auditRequestSchema.safeParse({ source: "extension", profile: { headline: 5 }, targetRole: null, analysisIds: [] }).success).toBe(false)
  })
})

describe("isStuck", () => {
  it("treats a running audit older than ten minutes as stuck", () => {
    const now = new Date("2026-10-22T12:00:00Z")
    expect(isStuck(new Date("2026-10-22T11:49:00Z"), now)).toBe(true)
    expect(isStuck(new Date("2026-10-22T11:55:00Z"), now)).toBe(false)
  })
})

describe("presentedStatus (son inceleme)", () => {
  const now = new Date("2026-10-23T12:00:00Z")
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000)

  it("shows an audit the worker has not touched for ten minutes as failed, so the waiting screen ends", () => {
    expect(presentedStatus({ status: "running", updatedAt: ago(11), report: null, rewrites: null }, now)).toBe("failed")
    expect(presentedStatus({ status: "running", updatedAt: ago(2), report: null, rewrites: null }, now)).toBe("running")
  })

  it("brings back the finished result when a retry gets stuck", () => {
    expect(presentedStatus({ status: "running", updatedAt: ago(11), report: {}, rewrites: {} }, now)).toBe("done")
  })

  it("leaves finished audits alone", () => {
    expect(presentedStatus({ status: "done", updatedAt: ago(60), report: {}, rewrites: {} }, now)).toBe("done")
    expect(presentedStatus({ status: "failed", updatedAt: ago(60), report: null, rewrites: null }, now)).toBe("failed")
  })
})
