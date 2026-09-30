import { describe, expect, it } from "vitest"
import { suggestEmail as suggestEmail, mailAppFor as mailAppFor } from "@/features/auth/emailHints"

describe("suggestEmail", () => {
  it.each([
    ["ali@gmial.com", "ali@gmail.com"],
    ["ali@gmai.com", "ali@gmail.com"],
    ["ali@gmail.co", "ali@gmail.com"],
    ["ayse@hotmial.com", "ayse@hotmail.com"],
    ["ayse@outlok.com", "ayse@outlook.com"],
    ["can@yandex.com.rt", "can@yandex.com.tr"],
    ["Ali@GMIAL.com", "Ali@gmail.com"],
  ])("%s → %s", (inputValue, expected) => {
    expect(suggestEmail(inputValue)).toBe(expected)
  })

  it.each(["ali@gmail.com", "ali@acme.com", "ali@sirketim.com.tr", "ali", "ali@", "ali@gmail"])(
    "no suggestion for %s",
    (inputValue) => {
      expect(suggestEmail(inputValue)).toBeNull()
    },
  )
})

describe("mailAppFor", () => {
  it("returns a webmail URL for known domains", () => {
    expect(mailAppFor("ali@gmail.com")?.name).toBe("Gmail")
    expect(mailAppFor("ali@hotmail.com")?.name).toBe("Outlook")
    expect(mailAppFor("ali@hotmail.com")?.action).toBe("Outlook'u aç")
    expect(mailAppFor("ali@yandex.com.tr")?.name).toBe("Yandex Mail")
  })

  it("no shortcut for an unknown domain", () => {
    expect(mailAppFor("ali@acme.com")).toBeNull()
  })
})
