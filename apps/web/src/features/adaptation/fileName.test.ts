import { describe, expect, it } from "vitest"
import { downloadFileName } from "@/features/adaptation/fileName"

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
