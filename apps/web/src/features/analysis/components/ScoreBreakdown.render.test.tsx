import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ScoreBreakdown } from "@/features/analysis/components/ScoreBreakdown"
import type { Declaration } from "@uyarla/core/adapt/declarations"
import type { ScorePart } from "@/features/analysis/scoreParts"

const part = (index: number | null, label: string, credit: number, gain: number, type: ScorePart["type"] = "skill", missing: string[] = [label]): ScorePart => ({
  index,
  label,
  kind: type === "title" ? "title" : "must",
  type,
  missing,
  weight: 2,
  credit,
  gain,
})
const at = "2026-11-06T00:00:00.000Z"
const skill = (requirementIndex: number): Declaration => ({ requirementIndex, kind: "skill", terms: ["HTML"], at })
const experience = (requirementIndex: number): Declaration => ({
  requirementIndex,
  kind: "experience",
  target: { section: "experience", index: 0 },
  text: "Paneli React ile yaptım",
  at,
})
const declare = {
  declarations: [] as Declaration[],
  locked: false,
  targets: [{ section: "experience" as const, index: 0, label: "Acme · Geliştirici" }],
  onChange: async () => {},
}
const html = (p: ScorePart, d?: typeof declare) => renderToStaticMarkup(<ScoreBreakdown parts={[p]} declare={d} />)

describe("ScoreBreakdown", () => {
  it("lists what the CV has above what it lacks", () => {
    const html = renderToStaticMarkup(<ScoreBreakdown parts={[part(0, "Docker", 0, 12), part(1, "React", 1, 0)]} />)
    expect(html.indexOf("CV&#x27;nde var")).toBeLessThan(html.indexOf("React"))
    expect(html.indexOf("React")).toBeLessThan(html.indexOf("CV&#x27;nde görünmüyor"))
    expect(html.indexOf("CV&#x27;nde görünmüyor")).toBeLessThan(html.indexOf("Docker"))
  })

  it("shows the points a missing row would add", () => {
    const html = renderToStaticMarkup(<ScoreBreakdown parts={[part(0, "Docker", 0, 12)]} />)
    expect(html).toContain("+12")
  })

  it("marks a partial match and what completing it would add", () => {
    const html = renderToStaticMarkup(<ScoreBreakdown parts={[part(0, "TypeScript", 0.5, 6)]} />)
    expect(html).toContain("kısmen")
    expect(html).toContain("+6")
  })

  it("leaves out a group with no rows", () => {
    const html = renderToStaticMarkup(<ScoreBreakdown parts={[part(0, "React", 1, 0)]} />)
    expect(html).not.toContain("görünmüyor")
  })

  it("offers 'Bende var' on a missing skill", () => {
    expect(html(part(0, "HTML", 0, 8), declare)).toContain("Bende var")
  })

  it("offers 'Bende var' on a partial row", () => {
    expect(html(part(0, "Google Ads ve Meta", 0.5, 8, "skill", ["Meta"]), declare)).toContain("Bende var")
  })

  it("shows no button on the title row", () => {
    expect(html(part(null, "İlandaki unvan: X", 0, 15, "title"), declare)).not.toContain("Bende var")
  })

  it("shows no button on a met row", () => {
    expect(html(part(0, "React", 1, 0), declare)).not.toContain("Bende var")
  })

  it("shows no button without a declare prop (sample report)", () => {
    expect(html(part(0, "HTML", 0, 8))).not.toContain("Bende var")
  })

  it("shows no button on an experience row when there is nowhere to put it", () => {
    expect(html(part(0, "3 yıl", 0, 15, "experience"), { ...declare, targets: [] })).not.toContain("Bende var")
  })

  it("tags a declared row and offers undo", () => {
    const out = html(part(0, "HTML", 1, 0), { ...declare, declarations: [skill(0)] })
    expect(out).toContain("sen ekledin")
    expect(out).toContain("geri al")
  })

  it("says so when a declaration left the score unchanged", () => {
    const out = html(part(0, "3 yıl", 0, 15, "experience"), { ...declare, declarations: [experience(0)] })
    expect(out).toContain("Eklendi, CV&#x27;ne girecek; bu şart skoru değiştirmedi")
    expect(out).not.toContain("Bende var")
  })

  it("locks after the adaptation started, keeping the tag", () => {
    const out = html(part(0, "HTML", 1, 0), { ...declare, locked: true, declarations: [skill(0)] })
    expect(out).toContain("sen ekledin")
    expect(out).not.toContain("geri al")
  })

  it("points to the adaptation screen on a locked missing row", () => {
    const out = html(part(0, "HTML", 0, 8), { ...declare, locked: true })
    expect(out).not.toContain("Bende var")
    expect(out).toContain("Uyarlama ekranından madde ekleyebilirsin")
  })

  it("draws nothing without parts", () => {
    expect(renderToStaticMarkup(<ScoreBreakdown parts={[]} />)).toBe("")
  })
})
