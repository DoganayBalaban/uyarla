import { describe, expect, it, vi } from "vitest"
import { HEADLINE_MAX_CHARS } from "./reportRecord.js"
import { capHeadline, experienceTemplate, hasFailedRewrites, mergeRetried, writeLinkedInRewrites, type LinkedInRewrites } from "./rewrite.js"
import { deniz } from "./testProfile.js"

const profileReply = {
  basliklar: ["Performance Marketing Specialist | Google Ads, GA4", "Performance Marketing | Meta ve Google reklamları", "E-ticaret büyümesi | Google Ads, Looker Studio"],
  hakkinda: "Moda Sepeti'nde Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönetiyorum.",
}
const experienceReply = { aciklamalar: [{ sira: 1, metin: "• Meta kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.\n• GA4 panolarıyla haftalık rapor hazırladım." }] }

function llmWith(...replies: unknown[]) {
  const extract = vi.fn()
  for (const r of replies) extract.mockImplementationOnce(async () => (r instanceof Error ? Promise.reject(r) : { data: r, tokens: 10 }))
  return { extract } as never
}

describe("writeLinkedInRewrites", () => {
  it("writes three headlines, an about text and each described role, verified", async () => {
    const { rewrites, tokens } = await writeLinkedInRewrites(llmWith(profileReply, experienceReply), { profile: deniz(), targetRole: null, strengths: ["Google Ads"], postings: [] })
    expect(tokens).toBe(20)
    if (rewrites.headline.status !== "done" || rewrites.about.status !== "done") throw new Error("beklenmedik")
    expect(rewrites.headline.options).toHaveLength(3)
    expect(rewrites.about.suggestion.verification.status).toBe("ok")
    expect(rewrites.experience).toEqual([{ index: 0, status: "done", suggestion: expect.objectContaining({ text: experienceReply.aciklamalar[0]!.metin }) }])
  })

  it("flags a rewritten line whose number is not in the profile", async () => {
    const reply = { aciklamalar: [{ sira: 1, metin: "• Satışları %50 artırdım." }] }
    const { rewrites } = await writeLinkedInRewrites(llmWith(profileReply, reply), { profile: deniz(), targetRole: null, strengths: [], postings: [] })
    const role = rewrites.experience[0]!
    expect(role.status === "done" && role.suggestion.verification.status).toBe("flagged")
  })

  it("gives a template, not a rewrite, for a role without a description", async () => {
    const profile = deniz({ experience: [{ title: "Asistan", company: "Beta", dateRange: "2020 - 2021", location: null, description: null }] })
    const llm = llmWith(profileReply)
    const { rewrites } = await writeLinkedInRewrites(llm, { profile, targetRole: null, strengths: [], postings: [] })
    expect(rewrites.experience).toEqual([{ index: 0, status: "template", text: experienceTemplate("tr") }])
    // Açıklamalı rol yoksa deneyim çağrısı yapılmıyor.
    expect((llm as unknown as { extract: ReturnType<typeof vi.fn> }).extract).toHaveBeenCalledTimes(1)
  })

  it("marks only the part whose call failed", async () => {
    const { rewrites } = await writeLinkedInRewrites(llmWith(profileReply, new Error("zaman aşımı")), { profile: deniz(), targetRole: null, strengths: [], postings: [] })
    expect(rewrites.headline.status).toBe("done")
    expect(rewrites.experience).toEqual([{ index: 0, status: "failed" }])
    expect(hasFailedRewrites(rewrites)).toBe(true)
  })

  it("writes English for an English profile", async () => {
    const llm = llmWith(profileReply, experienceReply)
    const en = deniz({
      headline: "Performance Marketing Specialist",
      about: "I manage Meta and Google campaigns for e-commerce brands and report results weekly with GA4 dashboards.",
      experience: [{ title: "Performance Marketing Specialist", company: "Moda Sepeti", dateRange: "Mar 2023 - Present", location: null, description: "• Managed Meta campaigns with a monthly budget of 1.2 million TL.\n• Built weekly GA4 dashboards for the marketing team." }],
      education: [{ school: "Marmara University", degree: "Bachelor's, Business", dateRange: "2017 - 2021", description: null }],
      languages: ["English"],
    })
    await writeLinkedInRewrites(llm, { profile: en, targetRole: null, strengths: [], postings: [] })
    const input = (llm as unknown as { extract: ReturnType<typeof vi.fn> }).extract.mock.calls[0]![0].input as string
    expect(input).toContain("DİL: İngilizce")
  })
})

describe("capHeadline, mergeRetried, experienceTemplate", () => {
  it("cuts a long headline at the last separator", () => {
    const long = `Performance Marketing Specialist | ${"Google Ads, ".repeat(20)}GA4`
    const cut = capHeadline(long)
    expect(cut.length).toBeLessThanOrEqual(HEADLINE_MAX_CHARS)
    expect(cut.endsWith(",")).toBe(false)
  })

  it("replaces only failed parts on retry", () => {
    const previous: LinkedInRewrites = {
      headline: { status: "done", options: [{ text: "Eski", verification: { status: "ok", issues: [] } }] },
      about: { status: "failed" },
      experience: [{ index: 0, status: "failed" }, { index: 1, status: "template", text: "şablon" }],
    }
    const fresh: LinkedInRewrites = {
      headline: { status: "done", options: [{ text: "Yeni", verification: { status: "ok", issues: [] } }] },
      about: { status: "done", suggestion: { text: "Hakkında", verification: { status: "ok", issues: [] } } },
      experience: [{ index: 0, status: "done", suggestion: { text: "Rol", verification: { status: "ok", issues: [] } } }, { index: 1, status: "template", text: "şablon" }],
    }
    const merged = mergeRetried(previous, fresh)
    expect(merged.headline).toEqual(previous.headline)
    expect(merged.about.status).toBe("done")
    expect(merged.experience[0]!.status).toBe("done")
    expect(hasFailedRewrites(merged)).toBe(false)
  })

  it("templates use placeholders, never invented facts", () => {
    expect(experienceTemplate("tr")).toMatch(/\[.+\]/)
    expect(experienceTemplate("en")).toMatch(/\[.+\]/)
  })
})
