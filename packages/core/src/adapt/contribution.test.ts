import { describe, expect, it, vi } from "vitest"
import type { LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import { hasPendingDecisions, type AdaptationDraft } from "../schemas/adaptation.js"
import { buildContribution, verifyContribution, writeContribution } from "./contribution.js"

const posting: JobPostingData = {
  position: "Backend Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    { text: "Docker ve Kubernetes deneyimi", type: "skill", importance: "must", concepts: [{ term: "Docker", synonyms: [] }, { term: "Kubernetes", synonyms: [] }] },
  ],
}

const llm = (rewritten: string): LlmProvider => ({ extract: vi.fn(async () => ({ data: { rewritten } as never, tokens: 9 })) })

describe("writeContribution", () => {
  it("sends the requirement, the answer and the language, and trims the result", async () => {
    const provider = llm("  Staj projesinde 3 servisi Docker Compose ile ayağa kaldırdım.  ")
    const { data, tokens } = await writeContribution(provider, {
      requirement: "Docker ve Kubernetes deneyimi",
      answer: " staj projesinde docker compose ile 3 servisi ayağa kaldırdım ",
    })
    expect(data.text).toBe("Staj projesinde 3 servisi Docker Compose ile ayağa kaldırdım.")
    expect(tokens).toBe(9)
    const input = (provider.extract as ReturnType<typeof vi.fn>).mock.calls[0]![0].input as string
    expect(input).toContain("Gereksinim: Docker ve Kubernetes deneyimi")
    expect(input).toContain("Adayın metni: staj projesinde docker compose ile 3 servisi ayağa kaldırdım")
    expect(input).toContain("Dil: Türkçe")
  })

  it("returns empty text when the model decides the answer is not an experience", async () => {
    const { data } = await writeContribution(llm(""), { requirement: "Docker", answer: "bilmiyorum ama öğrenebilirim" })
    expect(data.text).toBe("")
  })
})

describe("verifyContribution", () => {
  const answer = "staj projesinde docker compose ile 3 servisi ayağa kaldırdım"

  it("passes a faithful bullet", () => {
    expect(verifyContribution("Staj projesinde 3 servisi Docker Compose ile ayağa kaldırdım.", answer, posting).status).toBe("ok")
  })

  it("flags a posting term the user never mentioned", () => {
    const v = verifyContribution("Staj projesinde 3 servisi Docker ve Kubernetes ile yönettim.", answer, posting)
    expect(v.status).toBe("flagged")
    expect(v.issues.map((i) => i.kind)).toContain("posting_term_injected")
  })

  it("flags a number the user never wrote", () => {
    const v = verifyContribution("Staj projesinde 5 servisi Docker Compose ile ayağa kaldırdım.", answer, posting)
    expect(v.issues.map((i) => i.kind)).toContain("number_mismatch")
  })
})

describe("hasPendingDecisions · contributions", () => {
  const base: AdaptationDraft = {
    summary: { original: null, rewritten: "", verification: { status: "ok", issues: [] }, decision: "accepted" },
    bullets: [],
    skillOrder: [],
  }
  const c = { id: "c1", requirementIndex: 0, experienceIndex: 0, answer: "x", verification: { status: "flagged" as const, issues: [] } }

  it("blocks download for a written but undecided contribution only", () => {
    expect(hasPendingDecisions({ ...base, contributions: [{ ...c, status: "done", text: "y", decision: "pending" }] })).toBe(true)
    expect(hasPendingDecisions({ ...base, contributions: [{ ...c, status: "running", decision: "pending" }] })).toBe(false)
    expect(hasPendingDecisions({ ...base, contributions: [{ ...c, status: "done", text: "y", decision: "rejected" }] })).toBe(false)
  })
})

describe("buildContribution", () => {
  const reportingPosting: JobPostingData = {
    ...posting,
    requirements: [{ text: "Raporlama", type: "skill", importance: "must", concepts: [{ term: "raporlama", synonyms: [] }] }],
  }
  const answer = "her hafta satış rakamlarını excelde özetleyip müdüre sunuyordum"
  const llmWith = (data: object): LlmProvider => ({ extract: vi.fn(async () => ({ data: data as never, tokens: 5 })) })
  const embedding = (similar: boolean) => ({
    embed: vi.fn(async (texts: string[]) => texts.map((_, i) => (similar || i % 2 === 0 ? [1, 0] : [0, 1]))),
  })

  it("accepts a faithful bullet without term alignments", async () => {
    const r = await buildContribution(llmWith({ rewritten: "Haftalık satış rakamlarını Excel'de özetleyip müdüre sundum.", alignments: [] }), embedding(true), {
      requirement: reportingPosting.requirements[0]!,
      answer,
      posting: reportingPosting,
    })
    expect(r).toMatchObject({ verification: { status: "ok" }, alignments: [], decision: "accepted" })
  })

  it("keeps a verified alignment, allows its term and waits for the user's confirmation", async () => {
    const r = await buildContribution(
      llmWith({
        rewritten: "Haftalık satış rakamlarını Excel'de özetleyip müdüre sunarak düzenli raporlama yaptım.",
        alignments: [{ term: "raporlama", basis: "excelde özetleyip müdüre sunuyordum" }],
      }),
      embedding(true),
      { requirement: reportingPosting.requirements[0]!, answer, posting: reportingPosting },
    )
    expect(r.verification.status).toBe("ok")
    expect(r.alignments).toEqual([{ term: "raporlama", basis: "excelde özetleyip müdüre sunuyordum" }])
    expect(r.decision).toBe("pending")
  })

  it("drops an alignment whose term the bullet never uses", async () => {
    const r = await buildContribution(
      llmWith({ rewritten: "Haftalık satış rakamlarını Excel'de özetleyip müdüre sundum.", alignments: [{ term: "raporlama", basis: "müdüre sunuyordum" }] }),
      embedding(true),
      { requirement: reportingPosting.requirements[0]!, answer, posting: reportingPosting },
    )
    expect(r.alignments).toEqual([])
    expect(r.decision).toBe("accepted")
  })

  it("returns an empty bullet without calling embeddings when the answer is not an experience", async () => {
    const emb = embedding(true)
    const r = await buildContribution(llmWith({ rewritten: "", alignments: [] }), emb, {
      requirement: reportingPosting.requirements[0]!,
      answer: "bilmiyorum ama öğrenebilirim",
      posting: reportingPosting,
    })
    expect(r.text).toBe("")
    expect(emb.embed).not.toHaveBeenCalled()
  })
})
