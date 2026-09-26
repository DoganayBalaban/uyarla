import { describe, expect, it } from "vitest"
import { epostaOnerisi, postaUygulamasi } from "./eposta"

describe("epostaOnerisi", () => {
  it.each([
    ["ali@gmial.com", "ali@gmail.com"],
    ["ali@gmai.com", "ali@gmail.com"],
    ["ali@gmail.co", "ali@gmail.com"],
    ["ayse@hotmial.com", "ayse@hotmail.com"],
    ["ayse@outlok.com", "ayse@outlook.com"],
    ["can@yandex.com.rt", "can@yandex.com.tr"],
    ["Ali@GMIAL.com", "Ali@gmail.com"],
  ])("%s → %s", (girdi, beklenen) => {
    expect(epostaOnerisi(girdi)).toBe(beklenen)
  })

  it.each(["ali@gmail.com", "ali@acme.com", "ali@sirketim.com.tr", "ali", "ali@", "ali@gmail"])(
    "%s için öneri yok",
    (girdi) => {
      expect(epostaOnerisi(girdi)).toBeNull()
    },
  )
})

describe("postaUygulamasi", () => {
  it("bilinen alanlar için web posta adresi veriyor", () => {
    expect(postaUygulamasi("ali@gmail.com")?.ad).toBe("Gmail")
    expect(postaUygulamasi("ali@hotmail.com")?.ad).toBe("Outlook")
    expect(postaUygulamasi("ali@hotmail.com")?.eylem).toBe("Outlook'u aç")
    expect(postaUygulamasi("ali@yandex.com.tr")?.ad).toBe("Yandex Mail")
  })

  it("bilinmeyen alan için kısayol yok", () => {
    expect(postaUygulamasi("ali@acme.com")).toBeNull()
  })
})
