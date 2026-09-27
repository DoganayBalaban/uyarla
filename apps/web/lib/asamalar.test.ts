import { describe, expect, it } from "vitest"
import { asamalariTuret } from "./asamalar"

const T = [{ id: "a", baslik: "A" }, { id: "b", baslik: "B" }, { id: "c", baslik: "C" }]
const durumlar = (x: { durum: string }[]) => x.map((a) => a.durum)

describe("asamalariTuret", () => {
  it("aktiften öncekiler tamam, sonrakiler sırada", () => {
    expect(durumlar(asamalariTuret(T, "b"))).toEqual(["tamam", "aktif", "bekliyor"])
  })
  it("aşama bilinmiyorsa ilki aktif", () => {
    expect(durumlar(asamalariTuret(T, null))).toEqual(["aktif", "bekliyor", "bekliyor"])
  })
  it("bittiyse hepsi tamam", () => {
    expect(durumlar(asamalariTuret(T, "c", true))).toEqual(["tamam", "tamam", "tamam"])
  })
})
