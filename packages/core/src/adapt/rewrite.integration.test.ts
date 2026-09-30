import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import { verifyRewrite } from "../verify/verify.js"
import { rewriteBullet } from "./rewrite.js"

const testPosting: JobPostingData = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    {
      text: "React ve TypeScript deneyimi",
      type: "skill",
      importance: "must",
      concepts: [
        { term: "React", synonyms: ["react.js"] },
        { term: "TypeScript", synonyms: ["ts"] },
      ],
    },
    {
      text: "Kubernetes deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "Kubernetes", synonyms: ["k8s"] }],
    },
  ],
}

describe("rewriteBullet · real model", () => {
  it("uses a term with a basis and not one without", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const sourceText = "React ile müşteri panelini geliştirdim ve yüklenme süresini %40 düşürdüm"

    const { data } = await rewriteBullet(llm, {
      bullet: sourceText,
      targets: ["Web performansı", "Kubernetes"],
    })
    const verificationResult = verifyRewrite({
      rewritten: data.text,
      source: sourceText,
      posting: testPosting,
      allowedTerms: data.alignments.map((a) => a.term),
    })

    console.log(`[ölçüm] kaynak: ${sourceText}`)
    console.log(`[ölçüm] yazım : ${data.text}`)
    console.log(`[ölçüm] uyum  : ${JSON.stringify(data.alignments)}`)
    console.log(`[ölçüm] uyarı : ${verificationResult.issues.map((i) => i.kind).join(", ") || "yok"}`)

    expect(data.text.length).toBeGreaterThan(0)
    // CV'de karşılığı olmayan Kubernetes eklenmemeli.
    expect(data.text).not.toMatch(/kubernetes/i)
    expect(verificationResult.issues.filter((i) => i.kind === "number_mismatch")).toEqual([])
  })
})
