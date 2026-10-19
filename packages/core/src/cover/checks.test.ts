import { describe, expect, it } from "vitest"
import { checkCoverLetter } from "./checks.js"

const words = (n: number) => Array.from({ length: n }, () => "kelime").join(" ")

describe("checkCoverLetter", () => {
  const posting = { company: "Acme Teknoloji A.Ş.", position: "Kıdemli Backend Geliştirici (Go)" }

  it("finds the company without its legal suffix and the title without seniority", () => {
    const checks = checkCoverLetter(
      ["Acme'deki Backend Geliştirici pozisyonuna başvuruyorum.", words(150)],
      posting,
    )
    expect(checks.company).toEqual({ name: posting.company, mentioned: true })
    expect(checks.title).toEqual({ position: posting.position, mentioned: true })
    expect(checks.length).toBe("ok")
  })

  it("reports a missing company and title, and the length", () => {
    const checks = checkCoverLetter(["Bu pozisyona başvuruyorum."], posting)
    expect(checks.company?.mentioned).toBe(false)
    expect(checks.title?.mentioned).toBe(false)
    expect(checks.length).toBe("short")
    expect(checkCoverLetter([words(320)], posting).length).toBe("long")
  })

  it("skips the company check when the posting has none", () => {
    expect(checkCoverLetter(["metin"], { company: null, position: "Muhasebe Uzmanı" }).company).toBeNull()
  })

  it("lists cliches and negative phrases with their sentence", () => {
    const checks = checkCoverLetter(
      ["Sonuç odaklı ve takım oyuncusuyum. Maalesef SAP deneyimim yok."],
      { company: null, position: "x" },
    )
    expect(checks.cliches.map((c) => [c.kind, c.phrase])).toEqual([
      ["cliche", "takım oyuncusu"],
      ["cliche", "sonuç odaklı"],
      ["negative", "maalesef"],
      ["negative", "deneyimim yok"],
    ])
    expect(checks.cliches[0]!.line).toBe("Sonuç odaklı ve takım oyuncusuyum.")
  })
})
