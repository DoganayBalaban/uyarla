import { describe, expect, it } from "vitest"
import type { EmbeddingProvider } from "../llm/types.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { profileText, rankJobs } from "./rank.js"
import type { ExternalJob } from "./sources.js"

const job = (title: string, snippet = ""): ExternalJob => ({
  source: "jooble", origin: null, title, company: null, location: null, snippet, url: `https://x/${title}`, postedAt: null,
})

/** Metinde "muhasebe" geçiyorsa birinci eksen, geçmiyorsa ikinci eksen. */
const embedding: EmbeddingProvider = {
  async embed(texts) {
    return texts.map((t) => (/muhasebe/i.test(t) ? [1, 0] : [0, 1]))
  },
}

const profile: ResumeProfile = {
  fullName: "Ece", headline: null, summary: "Genel muhasebe deneyimi",
  experience: [{ company: "Atlas", title: "Muhasebe Uzmanı", startDate: "2022", endDate: "halen", bullets: [] }],
  education: [], skills: ["Logo"], languages: [], certifications: [],
}

describe("rankJobs", () => {
  it("orders jobs by similarity to the resume, most similar first", async () => {
    const ranked = await rankJobs(embedding, profile, [job("Satış Temsilcisi"), job("Muhasebe Uzmanı")])
    expect(ranked.map((r) => r.job.title)).toEqual(["Muhasebe Uzmanı", "Satış Temsilcisi"])
    expect(ranked[0]!.similarity).toBeCloseTo(1)
  })

  it("drops duplicates that two sources return for the same posting", async () => {
    const ranked = await rankJobs(embedding, profile, [job("Muhasebe Uzmanı", "a"), job("muhasebe uzmanı ", "b")])
    expect(ranked).toHaveLength(1)
  })

  it("handles an empty list without calling the embedding", async () => {
    expect(await rankJobs({ embed: async () => { throw new Error("çağrılmamalı") } }, profile, [])).toEqual([])
  })
})

describe("profileText", () => {
  it("joins summary, titles and skills", () => {
    expect(profileText(profile)).toBe("Genel muhasebe deneyimi\nMuhasebe Uzmanı\nLogo")
  })
})
