import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import { DELETION_ORDER } from "@/server/deleteAccount"
import { EXPORTED_TABLES, buildExportZip, type UserDataExport } from "@/server/dataExport"

const DATA: UserDataExport = {
  exportedAt: "2026-10-12T12:00:00.000Z",
  user: { email: "ayse@ornek.com", name: "Ayşe", createdAt: "2026-10-01T00:00:00.000Z" },
  accounts: [],
  sessions: [],
  resumes: [
    { id: "r1", fileName: "cv.pdf", filePath: "resumes/a.pdf", versions: [] },
    { id: "r2", fileName: "eski.docx", filePath: "resumes/b.docx", versions: [] },
  ],
  jobPostings: [],
  analyses: [],
  accessPasses: [],
}

describe("data export", () => {
  it("covers every table the account deletion covers", () => {
    // DOG-63: silinen her tablo indirilebilmeli (KVKK md. 11); biri eklenip
    // ötekinde unutulursa bu test kırmızıya döner.
    expect([...EXPORTED_TABLES].sort()).toEqual([...DELETION_ORDER].sort())
  })

  it("packs the data as JSON and the original resume files", async () => {
    const zip = await JSZip.loadAsync(
      await buildExportZip(DATA, async (path) => (path === "resumes/a.pdf" ? Buffer.from("PDF") : null)),
    )

    const json = JSON.parse(await zip.file("veriler.json")!.async("string"))
    expect(json.user.email).toBe("ayse@ornek.com")
    expect(await zip.file("cvler/r1-cv.pdf")!.async("string")).toBe("PDF")
    // Depoda bulunamayan dosya sessizce atlanmıyor, BENIOKU'da yazıyor.
    expect(zip.file("cvler/r2-eski.docx")).toBeNull()
    expect(await zip.file("BENIOKU.txt")!.async("string")).toContain("eski.docx")
  })

  it("does not leak the internal storage path", async () => {
    const zip = await JSZip.loadAsync(await buildExportZip(DATA, async () => Buffer.from("x")))
    expect(await zip.file("veriler.json")!.async("string")).not.toContain("resumes/a.pdf")
  })
})
