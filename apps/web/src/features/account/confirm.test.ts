import { describe, expect, it } from "vitest"
import { isDeleteConfirmed } from "@/features/account/confirm"

describe("isDeleteConfirmed", () => {
  it("accepts the word however the keyboard writes it", () => {
    // İngilizce klavyede "SIL" ya da "sil" yazan kullanıcı takılıyordu.
    for (const typed of ["SİL", "sil", " Sil ", "SIL", "sıl", "Sil"]) expect(isDeleteConfirmed(typed)).toBe(true)
  })

  it("rejects anything else", () => {
    for (const typed of ["", "si", "SİLİN", "evet", "SOL"]) expect(isDeleteConfirmed(typed)).toBe(false)
  })
})
