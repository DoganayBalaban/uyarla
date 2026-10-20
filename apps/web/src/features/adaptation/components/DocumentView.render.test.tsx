import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DocumentView } from "@/features/adaptation/components/DocumentView"
import { EditText } from "@/features/adaptation/components/EditText"

const outline = {
  headline: null,
  summary: "Frontend geliştirici",
  experience: [{ company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen", bullets: ["React ile panel geliştirdim"] }],
  skills: ["React", "CSS"],
}
const terms = [
  { term: "React", variants: ["React"], must: true },
  { term: "TypeScript", variants: ["TypeScript"], must: true },
  { term: "Next.js", variants: ["Next.js"], must: false },
]

describe("posting terms on the adaptation screen (DOG-92)", () => {
  it("document view offers highlighting and names the missing musts", () => {
    const html = renderToStaticMarkup(<DocumentView document={{ before: outline, after: outline }} draft={{ bullets: [], omitted: [] }} terms={terms} />)
    expect(html).toContain("İlanın terimlerini vurgula")
    expect(html).toContain("İlanın 3 teriminden 1 tanesi bu hâlde geçiyor.")
    expect(html).toContain("TypeScript")
    expect(html).not.toContain("Next.js</span>")
  })

  it("without terms the document view looks as before", () => {
    const html = renderToStaticMarkup(<DocumentView document={{ before: outline, after: outline }} draft={{ bullets: [], omitted: [] }} />)
    expect(html).not.toContain("vurgula")
  })

  it("edit button stays the same when not editing", () => {
    expect(renderToStaticMarkup(<EditText text="React" busy={false} onSave={async () => null} terms={terms} />)).toContain("Düzenle")
  })
})
