import { describe, it, expect } from "vitest"
import { PermanentError } from "@uyarla/core"
import { validateUpload } from "./upload.js"

const MB = 1024 * 1024
const ILAN = "Frontend Geliştirici aranıyor. React ve TypeScript bilgisi gereklidir."

describe("validateUpload", () => {
  it("geçerli PDF'i kabul eder", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 2 * MB }, ILAN)).not.toThrow()
  })

  it("geçerli DOCX'i kabul eder", () => {
    expect(() => validateUpload({ name: "cv.docx", size: 2 * MB }, ILAN)).not.toThrow()
  })

  it("uzantıyı büyük harfle yazılmış olsa da tanır", () => {
    expect(() => validateUpload({ name: "CV.PDF", size: 2 * MB }, ILAN)).not.toThrow()
  })

  it("desteklenmeyen uzantıyı reddeder", () => {
    expect(() => validateUpload({ name: "cv.txt", size: 100 }, ILAN)).toThrow(PermanentError)
  })

  it("uzantısız dosyayı reddeder", () => {
    expect(() => validateUpload({ name: "cv", size: 100 }, ILAN)).toThrow(PermanentError)
  })

  it("çok büyük dosyayı reddeder", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 11 * MB }, ILAN)).toThrow(PermanentError)
  })

  it("boş dosyayı reddeder", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 0 }, ILAN)).toThrow(PermanentError)
  })

  it("çok kısa ilan metnini reddeder", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 100 }, "kısa")).toThrow(PermanentError)
  })

  it("hata mesajları kullanıcıya gösterilebilir Türkçe olur", () => {
    // Marka rehberi §6: suçlamayan dil, sonraki adımı gösteren mesaj.
    const mesajlar: string[] = []
    for (const [dosya, ilan] of [
      [{ name: "cv.txt", size: 100 }, ILAN],
      [{ name: "cv.pdf", size: 11 * MB }, ILAN],
      [{ name: "cv.pdf", size: 100 }, "kısa"],
    ] as const) {
      try {
        validateUpload(dosya, ilan)
      } catch (error) {
        mesajlar.push((error as PermanentError).message)
      }
    }

    expect(mesajlar).toHaveLength(3)
    for (const m of mesajlar) {
      expect(m).toMatch(/[çğıöşüÇĞİÖŞÜ]|misin|mısın/)
      expect(m).not.toMatch(/error|invalid|failed/i)
    }
  })

  it("her hata ayrı bir kod taşır", () => {
    const kodlar = new Set<string>()
    for (const [dosya, ilan] of [
      [{ name: "cv.txt", size: 100 }, ILAN],
      [{ name: "cv.pdf", size: 11 * MB }, ILAN],
      [{ name: "cv.pdf", size: 100 }, "kısa"],
      [{ name: "cv.pdf", size: 0 }, ILAN],
    ] as const) {
      try {
        validateUpload(dosya, ilan)
      } catch (error) {
        kodlar.add((error as PermanentError).code)
      }
    }
    expect(kodlar.size).toBe(4)
  })
})
