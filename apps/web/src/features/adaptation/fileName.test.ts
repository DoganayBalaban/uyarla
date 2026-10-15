import { describe, expect, it } from "vitest"
import { downloadFileName, fileNameFromDisposition } from "@/features/adaptation/fileName"

describe("downloadFileName (DOG-64)", () => {
  it("uses the person's name with Turkish letters simplified", () => {
    expect(downloadFileName("Ayşe Yılmaz", "pdf")).toBe("Ayse-Yilmaz-CV.pdf")
    expect(downloadFileName("Çağrı Öztürk-Gül", "docx")).toBe("Cagri-Ozturk-Gul-CV.docx")
    expect(downloadFileName("İlkin Şen", "pdf")).toBe("Ilkin-Sen-CV.pdf")
  })

  it("drops characters that are unsafe in a file name", () => {
    expect(downloadFileName('Ali "Can" / Veli', "pdf")).toBe("Ali-Can-Veli-CV.pdf")
  })

  it("falls back to the generic name when there is no usable name", () => {
    expect(downloadFileName(null, "pdf")).toBe("uyarla-cv.pdf")
    expect(downloadFileName("İsimsiz", "pdf")).toBe("uyarla-cv.pdf")
    expect(downloadFileName("  ***  ", "docx")).toBe("uyarla-cv.docx")
  })
})

describe("fileNameFromDisposition (DOG-74)", () => {
  it("reads the name the server chose", () => {
    // İstemci sunucunun verdiği adı `a.download = "uyarla-cv.pdf"` ile eziyordu.
    expect(fileNameFromDisposition('attachment; filename="Ayse-Yilmaz-CV.pdf"', "uyarla-cv.pdf")).toBe("Ayse-Yilmaz-CV.pdf")
    expect(fileNameFromDisposition("attachment; filename=Ali-CV.docx", "uyarla-cv.docx")).toBe("Ali-CV.docx")
  })

  it("falls back when the header is missing or has no name", () => {
    expect(fileNameFromDisposition(undefined, "uyarla-cv.pdf")).toBe("uyarla-cv.pdf")
    expect(fileNameFromDisposition("attachment", "uyarla-cv.pdf")).toBe("uyarla-cv.pdf")
  })

  it("does not let a path sneak into the name", () => {
    expect(fileNameFromDisposition('attachment; filename="../../x.pdf"', "uyarla-cv.pdf")).toBe("x.pdf")
  })
})
