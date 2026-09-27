import { describe, expect, it } from "vitest"
import { VARSAYILAN_DONUS, girisAdresi, guvenliDonus } from "./donus"

describe("guvenliDonus", () => {
  it.each([
    ["/analyze?uyarla=abc", "/analyze?uyarla=abc"],
    ["/adapt/xyz", "/adapt/xyz"],
    ["/account", "/account"],
    ["/analyze#sonuc", "/analyze#sonuc"],
  ])("site içi %s kabul", (girdi, beklenen) => {
    expect(guvenliDonus(girdi)).toBe(beklenen)
  })

  it.each([
    null,
    undefined,
    "",
    "https://kotu.site",
    "//kotu.site",
    "/\\kotu.site",
    "javascript:alert(1)",
    "analyze",
    "/\t/kotu.site",
    "/login",
    "/login?donus=/analyze",
  ])("%s reddediliyor", (girdi) => {
    expect(guvenliDonus(girdi)).toBe(VARSAYILAN_DONUS)
  })
})

describe("girisAdresi", () => {
  it("varsayılan dönüşte parametre eklemiyor", () => {
    expect(girisAdresi()).toBe("/login")
    expect(girisAdresi("/analyze")).toBe("/login")
  })

  it("dönüş adresini kodluyor", () => {
    expect(girisAdresi("/analyze?uyarla=a1")).toBe("/login?donus=%2Fanalyze%3Fuyarla%3Da1")
  })
})
