import { describe, it, expect } from "vitest"
import { PermanentError } from "@uyarla/core"
import { validateJobText, validateResumeFile, validateUpload } from "./upload.js"

const MB = 1024 * 1024
const TEST_POSTING = "Frontend Geliştirici aranıyor. React ve TypeScript bilgisi gereklidir."

describe("validateUpload", () => {
  it("accepts a valid PDF", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 2 * MB }, TEST_POSTING)).not.toThrow()
  })

  it("accepts a valid DOCX", () => {
    expect(() => validateUpload({ name: "cv.docx", size: 2 * MB }, TEST_POSTING)).not.toThrow()
  })

  it("recognizes an uppercase extension", () => {
    expect(() => validateUpload({ name: "CV.PDF", size: 2 * MB }, TEST_POSTING)).not.toThrow()
  })

  it("rejects an unsupported extension", () => {
    expect(() => validateUpload({ name: "cv.txt", size: 100 }, TEST_POSTING)).toThrow(PermanentError)
  })

  it("rejects a file without an extension", () => {
    expect(() => validateUpload({ name: "cv", size: 100 }, TEST_POSTING)).toThrow(PermanentError)
  })

  it("rejects a file that is too large", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 11 * MB }, TEST_POSTING)).toThrow(PermanentError)
  })

  it("rejects an empty file", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 0 }, TEST_POSTING)).toThrow(PermanentError)
  })

  it("rejects posting text that is too short", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 100 }, "kısa")).toThrow(PermanentError)
  })

  it("error messages are user-facing Turkish", () => {
    // Marka rehberi §6: suçlamayan dil, sonraki adımı gösteren mesaj.
    const messages: string[] = []
    for (const [fileEntry, posting] of [
      [{ name: "cv.txt", size: 100 }, TEST_POSTING],
      [{ name: "cv.pdf", size: 11 * MB }, TEST_POSTING],
      [{ name: "cv.pdf", size: 100 }, "kısa"],
    ] as const) {
      try {
        validateUpload(fileEntry, posting)
      } catch (error) {
        messages.push((error as PermanentError).message)
      }
    }

    expect(messages).toHaveLength(3)
    for (const m of messages) {
      expect(m).toMatch(/[çğıöşüÇĞİÖŞÜ]|misin|mısın/)
      expect(m).not.toMatch(/error|invalid|failed/i)
    }
  })

  it("every error has its own code", () => {
    const codes = new Set<string>()
    for (const [fileEntry, posting] of [
      [{ name: "cv.txt", size: 100 }, TEST_POSTING],
      [{ name: "cv.pdf", size: 11 * MB }, TEST_POSTING],
      [{ name: "cv.pdf", size: 100 }, "kısa"],
      [{ name: "cv.pdf", size: 0 }, TEST_POSTING],
    ] as const) {
      try {
        validateUpload(fileEntry, posting)
      } catch (error) {
        codes.add((error as PermanentError).code)
      }
    }
    expect(codes.size).toBe(4)
  })

  it("rejects a missing file with its own code", () => {
    try {
      validateUpload(null, TEST_POSTING)
      expect.unreachable()
    } catch (error) {
      expect((error as PermanentError).code).toBe("missing_file")
    }
  })

  it("reports the file error before the job text error", () => {
    try {
      validateUpload({ name: "cv.txt", size: 100 }, "kısa")
      expect.unreachable()
    } catch (error) {
      expect((error as PermanentError).code).toBe("unsupported_format")
    }
  })

  it("returns the job text for saving", () => {
    expect(validateUpload({ name: "cv.pdf", size: 100 }, TEST_POSTING).jobText).toBe(TEST_POSTING)
  })
})

describe("validateResumeFile", () => {
  it("checks only the file", () => {
    expect(() => validateResumeFile({ name: "cv.pdf", size: 100 })).not.toThrow()
    try {
      validateResumeFile({ name: "cv.txt", size: 100 })
      expect.unreachable()
    } catch (error) {
      expect((error as PermanentError).code).toBe("unsupported_format")
    }
  })
})

describe("validateJobText", () => {
  it("returns the text or throws the short-text error", () => {
    expect(validateJobText(TEST_POSTING)).toBe(TEST_POSTING)
    expect(() => validateJobText("kısa")).toThrow(PermanentError)
  })
})
