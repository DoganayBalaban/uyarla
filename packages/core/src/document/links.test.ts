import { describe, it, expect } from "vitest"
import { linkParts } from "./links.js"

const links = (text: string, bareDomains = false) =>
  linkParts(text, { bareDomains })
    .filter((p) => p.href)
    .map((p) => [p.text, p.href])

describe("linkParts", () => {
  it("never changes the text", () => {
    const text = "Ece · ece@ornek.com · linkedin.com/in/ece · https://ece.dev/portfolyo."
    expect(linkParts(text, { bareDomains: true }).map((p) => p.text).join("")).toBe(text)
  })

  it("links e-mail, LinkedIn, GitHub and a portfolio in the contact line", () => {
    // cv-a'nın gerçek başlık satırı biçimi.
    expect(
      links("AI ENGINEER · Istanbul  •  ece@ornek.com  •  GitHub: github.com/aday  •  Portfolio: aday.example.app  •  Medium: @aday", true),
    ).toEqual([
      ["ece@ornek.com", "mailto:ece@ornek.com"],
      ["github.com/aday", "https://github.com/aday"],
      ["aday.example.app", "https://aday.example.app"],
    ])
  })

  it("keeps an explicit protocol and drops trailing punctuation", () => {
    expect(links("Site: https://ece.dev/is.")).toEqual([["https://ece.dev/is", "https://ece.dev/is"]])
    expect(links("www.ornek.com.tr, ")).toEqual([["www.ornek.com.tr", "https://www.ornek.com.tr"]])
  })

  it("does not take the domain of an e-mail as a separate link", () => {
    expect(links("ece@gmail.com", true)).toEqual([["ece@gmail.com", "mailto:ece@gmail.com"]])
  })

  it("does not link technology names", () => {
    // Bu adlar gövdede çok; ASP.NET büyük harfli olduğu için iletişim satırında da değil.
    expect(links("Node.js, Next.js ve ASP.NET ile servis yazdım")).toEqual([])
    expect(links(".NET Developer · ASP.NET Core", true)).toEqual([])
  })

  it("does not link bare domains in body lines, only known hosts and explicit URLs", () => {
    expect(links("ornek.com için kampanya yönettim")).toEqual([])
    expect(links("Kodu github.com/ece/proje adresinde")).toEqual([
      ["github.com/ece/proje", "https://github.com/ece/proje"],
    ])
  })

  it("returns the text as one part when there is no link", () => {
    expect(linkParts("Frontend Geliştirici")).toEqual([{ text: "Frontend Geliştirici", href: null }])
  })
})
