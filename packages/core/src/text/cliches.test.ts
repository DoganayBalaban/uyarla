import { describe, expect, it } from "vitest"
import { findCliches } from "./cliches.js"

describe("findCliches", () => {
  it("matches Turkish suffixes and capital letters", () => {
    expect(findCliches("STRES ALTINDA ÇALIŞABİLİRİM").map((h) => h.phrase)).toEqual(["stres altında çalışabil"])
    expect(findCliches("İletişim becerilerim güçlüdür.").map((h) => h.phrase)).toEqual(["iletişim becerilerim güçlü"])
  })

  it("leaves terms that only look like cliches", () => {
    expect(findCliches("Dinamik fiyatlandırma modeli kurdum. Sorumluluk matrisi hazırladım.")).toEqual([])
  })

  it("counts a phrase once, with its first sentence", () => {
    const hits = findCliches("Team player.\nAlso a team player again.")
    expect(hits).toEqual([{ phrase: "team player", kind: "cliche", line: "Team player." }])
  })
})
