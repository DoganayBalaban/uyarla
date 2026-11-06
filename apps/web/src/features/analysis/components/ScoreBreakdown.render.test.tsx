import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ScoreBreakdown } from "@/features/analysis/components/ScoreBreakdown"
import type { ScorePart } from "@/features/analysis/scoreParts"

const part = (index: number, label: string, credit: number, gain: number): ScorePart => ({ index, label, kind: "must", weight: 2, credit, gain })

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

  it("draws nothing without parts", () => {
    expect(renderToStaticMarkup(<ScoreBreakdown parts={[]} />)).toBe("")
  })
})
