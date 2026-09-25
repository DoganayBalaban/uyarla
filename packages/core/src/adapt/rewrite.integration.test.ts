import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import { verifyRewrite } from "../verify/verify.js"
import { rewriteBullet } from "./rewrite.js"

const ilan: JobPostingData = {
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

describe("rewriteBullet · gerçek model", () => {
  it("bir maddeyi yeniden yazar ve doğrulamadan geçer", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const kaynak = "React ile müşteri panelini geliştirdim ve yüklenme süresini %40 düşürdüm"

    const { data: yeni } = await rewriteBullet(llm, { bullet: kaynak, posting: ilan })
    const dogrulama = verifyRewrite({ rewritten: yeni, source: kaynak, posting: ilan })

    console.log(`[ölçüm] kaynak: ${kaynak}`)
    console.log(`[ölçüm] yazım : ${yeni}`)
    console.log(`[ölçüm] uyarı : ${dogrulama.issues.map((i) => i.kind).join(", ") || "yok"}`)

    expect(yeni.length).toBeGreaterThan(0)
    expect(yeni).not.toBe(kaynak)
    // CV'de olmayan Kubernetes eklenmemeli.
    expect(dogrulama.issues.filter((i) => i.kind === "posting_term_injected")).toEqual([])
  })
})
