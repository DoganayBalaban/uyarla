import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { LetterChecklist } from "@/features/adaptation/components/CoverLetterSection"

describe("LetterChecklist", () => {
  it("lists what passed and what to fix (DOG-96)", () => {
    const html = renderToStaticMarkup(
      <LetterChecklist
        checks={{
          company: { name: "Acme", mentioned: true },
          title: { position: "Muhasebe Uzmanı", mentioned: false },
          words: 90,
          length: "short",
          cliches: [{ phrase: "takım oyuncusu", kind: "cliche", line: "Takım oyuncusuyum." }],
        }}
      />,
    )
    expect(html).toContain("Şirket adı geçiyor (Acme)")
    expect(html).toContain("İlandaki unvan geçmiyor (Muhasebe Uzmanı)")
    expect(html).toContain("Kısa (90 kelime)")
    expect(html).toContain("takım oyuncusu")
  })
})
