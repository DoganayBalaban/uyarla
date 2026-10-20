import { describe, expect, it } from "vitest"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { EDIT_MAX_LENGTH, editDraftItem } from "./edit.js"
import { applyAdaptation } from "./profile.js"

const profile: ResumeProfile = {
  fullName: "Test Aday",
  headline: null,
  summary: "Frontend geliştirici",
  experience: [
    {
      company: "Acme",
      title: "Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [
        { text: "React ile panel yaptım", sourceRef: "React ile panel yaptım" },
        { text: "Sayfa açılışını %30 hızlandırdım", sourceRef: "Sayfa açılışını %30 hızlandırdım" },
      ],
    },
  ],
  education: [],
  skills: ["React", "TypeScript"],
  languages: [],
  certifications: [],
}

const posting: JobPostingData = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: "mid",
  language: "tr",
  requirements: [
    { text: "Kubernetes deneyimi", type: "technical", importance: "must", concepts: [{ term: "Kubernetes", synonyms: [] }] },
  ],
} as never

const draft: AdaptationDraft = {
  summary: { original: "Frontend geliştirici", rewritten: "React odaklı frontend geliştirici", verification: { status: "ok", issues: [] }, decision: "rejected" },
  bullets: [
    {
      id: "0-0",
      experienceIndex: 0,
      original: "React ile panel yaptım",
      sourceRef: "React ile panel yaptım",
      rewritten: "React ve TypeScript ile kullanıcı panelini geliştirdim",
      verification: { status: "ok", issues: [] },
      alignments: [{ term: "TypeScript", basis: "TypeScript" }],
      decision: "pending",
    },
  ],
  skillOrder: [],
}

describe("editDraftItem (DOG-92)", () => {
  it("takes the user's text as the new version and keeps alignments still in it", () => {
    const out = editDraftItem(draft, "0-0", "  React ve TypeScript ile\npanel geliştirdim ", { profile, posting })
    const b = out.bullets[0]!
    expect(b).toMatchObject({ rewritten: "React ve TypeScript ile panel geliştirdim", decision: "accepted", edited: true, verification: { status: "ok" } })
    expect(b.alignments).toEqual([{ term: "TypeScript", basis: "TypeScript" }])
    expect(applyAdaptation(profile, out).experience[0]!.bullets[0]!.text).toBe(b.rewritten)
    expect(draft.bullets[0]!.decision).toBe("pending")
  })

  it("accepts a fact moved from elsewhere in the CV, flags one that isn't there", () => {
    expect(editDraftItem(draft, "0-0", "React ile paneli %30 daha hızlı açılır hâle getirdim", { profile, posting }).bullets[0]!.verification.status).toBe("ok")
    const flagged = editDraftItem(draft, "0-0", "Kubernetes üzerinde React paneli %45 hızlandırdım", { profile, posting }).bullets[0]!
    expect(flagged.verification.status).toBe("flagged")
    expect(flagged.decision).toBe("accepted")
    expect(flagged.alignments).toEqual([])
  })

  it("going back to the original text is not an edit", () => {
    const b = editDraftItem(draft, "0-0", "React ile panel yaptım", { profile, posting }).bullets[0]!
    expect(b).toMatchObject({ rewritten: "React ile panel yaptım", alignments: [], verification: { status: "ok" } })
    expect(b.edited).toBeUndefined()
  })

  it("edits the summary", () => {
    const out = editDraftItem(draft, "summary", "React ve TypeScript ile çalışan frontend geliştirici", { profile, posting })
    expect(out.summary).toMatchObject({ decision: "accepted", edited: true, verification: { status: "ok" } })
  })

  it("rejects empty, too long and unknown items", () => {
    expect(() => editDraftItem(draft, "0-0", "   ", { profile, posting })).toThrow()
    expect(() => editDraftItem(draft, "0-0", "a".repeat(EDIT_MAX_LENGTH + 1), { profile, posting })).toThrow()
    expect(() => editDraftItem(draft, "9-9", "metin", { profile, posting })).toThrow()
  })
})
