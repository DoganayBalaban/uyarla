import { describe, expect, it } from "vitest"
import { resultPath, resumeRequest } from "@/features/analysis/paths"

describe("resultPath", () => {
  it("produces the permanent result path", () => {
    expect(resultPath("an 1")).toBe("/analyze?analiz=an%201")
  })
})

describe("resumeRequest", () => {
  it("reads the adaptation to resume and swaps the address to the result", () => {
    // Adres `?uyarla=` olarak kalırsa paket ekranından geri dönen kullanıcı
    // uyarlamayı yeniden tetikleyip yine paket ekranına düşüyordu.
    expect(resumeRequest("?uyarla=an%201")).toEqual({ analysisId: "an 1", address: "/analyze?analiz=an%201" })
  })

  it("is null without a resume parameter", () => {
    expect(resumeRequest("?analiz=an1")).toBeNull()
    expect(resumeRequest("")).toBeNull()
  })
})
