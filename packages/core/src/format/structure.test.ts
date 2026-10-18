import { describe, expect, it } from "vitest"
import type { FormatFinding } from "./check.js"
import { dateFormats, structureChecks } from "./structure.js"

function run(text: string): { codes: string[]; findings: FormatFinding[]; passed: string[] } {
  const findings: FormatFinding[] = []
  const passed: string[] = []
  structureChecks(text, findings, passed)
  return { codes: findings.map((f) => f.code), findings, passed }
}

const RESUME = (parts: { summary?: string; extra?: string; dates?: [string, string]; contact?: string }) => `Elif Yılmaz
elif@ornek.com${parts.contact ?? " · linkedin.com/in/elif"}
${parts.summary ?? "Özet\nReact ile arayüz geliştiren bir geliştiriciyim."}

Deneyim
Acme Yazılım — Frontend Geliştirici · ${parts.dates?.[0] ?? "03/2022 – Günümüz"}
• Panel geliştirdim ve 2023'te yükleme süresini %40 kısalttım.
Beta Yazılım — Stajyer · ${parts.dates?.[1] ?? "06/2021 – 09/2021"}
• Test yazdım.

Eğitim
İstanbul Üniversitesi (2016 – 2020)
${parts.extra ?? ""}`

describe("structureChecks (DOG-88)", () => {
  it("passes a complete resume without findings", () => {
    const r = run(RESUME({}))
    expect(r.codes).toEqual([])
    expect(r.passed).toEqual(["Özet", "Amaç bölümü yok", "Tarih biçimi", "Web bağlantısı", "Gereksiz ibare yok"])
  })

  it("warns when there is no summary", () => {
    expect(run(RESUME({ summary: "" })).codes).toEqual(["summary_missing"])
  })

  it("warns about an objective section", () => {
    const r = run(RESUME({ summary: "Kariyer Hedefi\nİyi bir şirkette çalışmak istiyorum." }))
    expect(r.codes).toContain("objective_heading")
    expect(r.findings.find((f) => f.code === "objective_heading")!.title).toContain("Kariyer Hedefi")
  })

  it("warns when experience dates mix formats, with the original spellings as examples", () => {
    const r = run(RESUME({ dates: ["Mart 2022 – Günümüz", "06/2021 – 09/2021"] }))
    expect(r.codes).toEqual(["date_format_mixed"])
    expect(r.findings[0]!.examples).toEqual(["Mart 2022", "06/2021"])
  })

  it("does not count years inside bullets or the education section", () => {
    // Madde içindeki "2023'te" ve eğitimdeki "2016 – 2020" biçim değil.
    expect(run(RESUME({})).codes).not.toContain("date_format_mixed")
  })

  it("warns when there is no LinkedIn or web link", () => {
    expect(run(RESUME({ contact: "" })).codes).toEqual(["web_presence_missing"])
  })

  it("flags a 'references on request' line", () => {
    const r = run(RESUME({ extra: "Referanslar istek üzerine verilecektir." }))
    expect(r.codes).toEqual(["references_on_request"])
    expect(r.findings[0]!.examples).toEqual(["Referanslar istek üzerine verilecektir."])
  })

  it("all new findings are content findings", () => {
    const r = run(RESUME({ summary: "", contact: "", extra: "References available upon request" }))
    expect(r.findings.every((f) => f.group === "content")).toBe(true)
  })
})

describe("dateFormats", () => {
  it("tells month names, numeric months and bare years apart", () => {
    expect([...dateFormats("Şubat 2023 – Halen\n01.2020 – 12/2021\n2018 – 2019").keys()]).toEqual(["month_name", "numeric", "year"])
  })

  it("does not take a grade point average for a date", () => {
    expect(dateFormats("Bilgisayar Mühendisliği · GPA 3.25/4.00").size).toBe(0)
  })
})
