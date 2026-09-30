import { describe, it, expect } from "vitest"
import type { JobPostingData } from "../schemas/job.js"
import { verifyRewrite, DEFAULT_VERIFICATION_CONFIG } from "./verify.js"

const testPosting: JobPostingData = {
  position: "Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    {
      text: "Kubernetes deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "Kubernetes", synonyms: ["k8s"] }],
    },
  ],
}

describe("verifyRewrite", () => {
  it("returns ok for a clean rewrite", () => {
    const v = verifyRewrite({
      rewritten: "React kullanarak müşteri panelini geliştirdim",
      source: "React ile müşteri panelini geliştirdim",
      posting: testPosting,
    })
    expect(v).toEqual({ status: "ok", issues: [] })
  })

  it("flags a number mismatch", () => {
    const v = verifyRewrite({
      rewritten: "Süreyi %60 düşürdüm",
      source: "Süreyi %40 düşürdüm",
      posting: testPosting,
    })
    expect(v.status).toBe("flagged")
    expect(v.issues.map((i) => i.kind)).toEqual(["number_mismatch"])
  })

  it("flags posting term injection", () => {
    const v = verifyRewrite({
      rewritten: "Kubernetes ile panel geliştirdim",
      source: "React ile panel geliştirdim",
      posting: testPosting,
    })
    expect(v.status).toBe("flagged")
    expect(v.issues.map((i) => i.kind)).toEqual(["posting_term_injected"])
  })

  it("collects all issues when several checks trigger", () => {
    const v = verifyRewrite({
      rewritten: "Kubernetes ile süreyi %60 düşürdüm",
      source: "React ile süreyi %40 düşürdüm",
      posting: testPosting,
    })
    expect(v.issues.map((i) => i.kind).sort()).toEqual([
      "number_mismatch",
      "posting_term_injected",
    ])
  })

  it("skips the drift check without vectors", () => {
    // Sapma kontrolü embedding gerektiriyor; çağıran onu sağlayamadığında
    // doğrulama tümüyle düşmemeli — ilk iki kontrol yine de çalışır.
    const v = verifyRewrite({
      rewritten: "React ile panel geliştirdim",
      source: "React ile panel geliştirdim",
      posting: testPosting,
    })
    expect(v.issues).toEqual([])
  })

  it("also flags drift when vectors are given", () => {
    const v = verifyRewrite({
      rewritten: "React ile panel geliştirdim",
      source: "React ile panel geliştirdim",
      posting: testPosting,
      vectors: { rewritten: [1, 0], source: [0, 1] },
    })
    expect(v.issues.map((i) => i.kind)).toEqual(["semantic_drift"])
  })

  it("the threshold is read from configuration", () => {
    // Eşik Görev 14'te eval verisiyle ayarlanacak; sabit yazılmamalı.
    const v = verifyRewrite(
      {
        rewritten: "a",
        source: "a",
        posting: testPosting,
        vectors: { rewritten: [0.8, 0.6], source: [1, 0] },
      },
      { driftThreshold: 0.9 },
    )
    expect(v.issues.map((i) => i.kind)).toEqual(["semantic_drift"])
  })

  it("the default threshold is the measured 0.70", () => {
    // K-33: 0.75'te tetiklenen üç maddenin üçü de sadık çeviriydi.
    expect(DEFAULT_VERIFICATION_CONFIG.driftThreshold).toBe(0.7)
  })
})
