import { describe, expect, it } from "vitest"
import {
  MAX_RESUME_TEXT_LENGTH,
  analysisFormSchema,
  analyzeFormSchema,
  jobUrlSchema,
  normalizeResumeText,
  resumeTextSchema,
} from "@/features/analysis/schema"
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

describe("analyzeFormSchema", () => {
  const cv = { name: "cv.pdf", size: 10 }

  it("accepts either a library CV or a new file", () => {
    expect(analyzeFormSchema.safeParse({ resumeId: "r1", jobText: POSTING, saveToLibrary: false }).success).toBe(true)
    expect(analyzeFormSchema.safeParse({ cv, jobText: POSTING, saveToLibrary: true }).success).toBe(true)
  })

  it("asks for a CV when neither is given", () => {
    const parsed = analyzeFormSchema.safeParse({ jobText: POSTING, saveToLibrary: false })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(firstIssue(parsed.error).code).toBe("missing_file")
  })

  it("rejects both at once", () => {
    expect(analyzeFormSchema.safeParse({ resumeId: "r1", cv, jobText: POSTING, saveToLibrary: false }).success).toBe(false)
  })

  it("still validates the file and the job text", () => {
    const parsed = analyzeFormSchema.safeParse({ cv: { name: "cv.txt", size: 10 }, jobText: "kısa", saveToLibrary: false })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(firstIssue(parsed.error).code).toBe("unsupported_format")
  })
})

describe("pasted CV text (DOG-101)", () => {
  const cvText = `Deniz Aksoy\nPerformans pazarlama uzmanı\n${"Google Ads ve Meta kampanyalarını yönettim. ".repeat(6)}`

  it("is a third way to give a CV, alone", () => {
    expect(analyzeFormSchema.safeParse({ cvText, jobText: POSTING, saveToLibrary: false }).success).toBe(true)
    const both = analyzeFormSchema.safeParse({ cvText, cv: { name: "cv.pdf", size: 10 }, jobText: POSTING, saveToLibrary: false })
    expect(both.success).toBe(false)
    if (!both.success) expect(firstIssue(both.error).code).toBe("ambiguous_resume")
  })

  it("asks for the whole CV when the text is too short or empty", () => {
    for (const text of ["", "Deniz Aksoy, pazarlama"]) {
      const parsed = analyzeFormSchema.safeParse({ cvText: text, jobText: POSTING, saveToLibrary: false })
      expect(parsed.success).toBe(false)
      if (!parsed.success) expect(firstIssue(parsed.error).code).toBe("resume_text_too_short")
    }
  })

  it("rejects text far longer than any CV", () => {
    const parsed = resumeTextSchema.safeParse("a".repeat(MAX_RESUME_TEXT_LENGTH + 1))
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(firstIssue(parsed.error).code).toBe("resume_text_too_long")
  })

  it("normalises line endings and outer whitespace", () => {
    expect(normalizeResumeText("  Ad\r\nSoyad\rİş\n  ")).toBe("Ad\nSoyad\nİş")
  })
})
