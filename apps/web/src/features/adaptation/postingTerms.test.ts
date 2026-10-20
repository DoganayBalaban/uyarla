import { describe, expect, it } from "vitest"
import { highlightParts, postingTermsFrom, termCoverage, termsIn } from "@/features/adaptation/postingTerms"

const reqs = [
  { type: "technical", importance: "must", concepts: [{ term: "React", synonyms: ["React.js"] }, { term: "TypeScript", synonyms: [] }] },
  { type: "technical", importance: "nice", concepts: [{ term: "Next.js", synonyms: [] }, { term: "React", synonyms: [] }] },
  { type: "soft", importance: "must", concepts: [{ term: "iletişim", synonyms: [] }] },
  { type: "condition", importance: "must", concepts: [{ term: "ehliyet", synonyms: [] }] },
  { type: "technical", importance: "must", concepts: [{ term: "SAP", synonyms: [] }] },
]

describe("posting terms (DOG-92)", () => {
  it("keeps scored terms once, leaves out conditions, soft traits and excluded", () => {
    const terms = postingTermsFrom(reqs, { excluded: [4], scoringRevision: 2 })
    expect(terms.map((t) => [t.term, t.must])).toEqual([
      ["React", true],
      ["TypeScript", true],
      ["Next.js", false],
    ])
  })

  it("finds terms, their synonyms and the missing musts", () => {
    const terms = postingTermsFrom(reqs, { excluded: [4], scoringRevision: 2 })
    expect(termsIn("React.js projelerinde çalıştım", terms).map((t) => t.term)).toEqual(["React"])
    const cov = termCoverage(["React ile panel", "Next.js"], terms)
    expect(cov.missing.map((t) => t.term)).toEqual(["TypeScript"])
  })

  it("splits text into highlighted parts", () => {
    const terms = postingTermsFrom(reqs, { scoringRevision: 2 })
    expect(highlightParts("React ve SAP kullandım.", terms)).toEqual([
      { text: "React", term: true },
      { text: " ve ", term: false },
      { text: "SAP", term: true },
      { text: " kullandım.", term: false },
    ])
  })
})
