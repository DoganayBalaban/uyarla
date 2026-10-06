import { describe, expect, it } from "vitest"
import { analysisFormSchema, jobUrlSchema } from "@/features/analysis/schema"
import { firstIssue } from "@/lib/validation"

const POSTING = "Frontend Geliştirici aranıyor. React ve TypeScript bilgisi gereklidir."

describe("analysisFormSchema", () => {
  it("accepts a browser-style File", () => {
    const cv = new File(["%PDF"], "cv.pdf", { type: "application/pdf" })
    expect(analysisFormSchema.safeParse({ cv, jobText: POSTING }).success).toBe(true)
  })

  it("does not require the client-only link field", () => {
    const parsed = analysisFormSchema.safeParse({ cv: { name: "cv.docx", size: 10 }, jobText: POSTING })
    expect(parsed.success).toBe(true)
  })

  it("exposes the issue code for the API response", () => {
    const parsed = analysisFormSchema.safeParse({ cv: { name: "cv.pdf", size: 0 }, jobText: POSTING })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(firstIssue(parsed.error).code).toBe("empty_file")
  })
})

describe("jobUrlSchema", () => {
  it("trims the link", () => {
    expect(jobUrlSchema.parse({ url: "  https://www.kariyer.net/is-ilani/x  " }).url).toBe(
      "https://www.kariyer.net/is-ilani/x",
    )
  })

  it("rejects an empty or missing link with a Turkish message", () => {
    for (const body of [{ url: "   " }, {}, { url: 3 }]) {
      const parsed = jobUrlSchema.safeParse(body)
      expect(parsed.success).toBe(false)
      if (!parsed.success) expect(firstIssue(parsed.error).message).toBe("İlan bağlantısını yapıştır.")
    }
  })
})
