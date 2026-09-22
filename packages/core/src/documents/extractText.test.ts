import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { extractText } from "./extractText.js"
import { PermanentError } from "../errors.js"

const fixture = (name: string) =>
  readFileSync(join(import.meta.dirname, "__fixtures__", name))

describe("extractText", () => {
  it("DOCX dosyasından metni çıkarır", async () => {
    const text = await extractText(fixture("ornek-cv.docx"), "ornek-cv.docx")
    expect(text).toContain("Deneyim")
    expect(text.length).toBeGreaterThan(100)
  })

  it("PDF dosyasından metni çıkarır", async () => {
    const text = await extractText(fixture("ornek-cv.pdf"), "ornek-cv.pdf")
    expect(text).toContain("Deneyim")
  })

  it("metin katmanı olmayan PDF için ayrı hata kodu döner", async () => {
    await expect(
      extractText(fixture("taranmis.pdf"), "taranmis.pdf"),
    ).rejects.toMatchObject({ code: "scanned_pdf" })
  })

  it("taranmış PDF mesajı kullanıcıya ne yapacağını söyler", async () => {
    await expect(
      extractText(fixture("taranmis.pdf"), "taranmis.pdf"),
    ).rejects.toThrow(/Word|metin katmanı/i)
  })

  it("bozuk PDF için okunamadı hatası verir", async () => {
    await expect(
      extractText(Buffer.from("bu bir PDF degil"), "bozuk.pdf"),
    ).rejects.toMatchObject({ code: "unreadable_file" })
  })

  it("desteklenmeyen uzantı için kalıcı hata fırlatır", async () => {
    await expect(
      extractText(Buffer.from("merhaba"), "cv.txt"),
    ).rejects.toBeInstanceOf(PermanentError)
  })

  it("uzantıyı büyük harfle yazılmış olsa da tanır", async () => {
    const text = await extractText(fixture("ornek-cv.docx"), "ORNEK-CV.DOCX")
    expect(text).toContain("Deneyim")
  })
})
