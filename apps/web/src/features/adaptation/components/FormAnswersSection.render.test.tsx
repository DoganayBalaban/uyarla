import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import { FormAnswersSection } from "@/features/adaptation/components/FormAnswersSection"

const render = (answers: Parameters<typeof FormAnswersSection>[0]["answers"]) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <FormAnswersSection adaptationId="ad1" analysisId="a1" answers={answers} />
    </QueryClientProvider>,
  )

describe("FormAnswersSection (DOG-123)", () => {
  it("shows answers with the counter against the limit and a flag", () => {
    const html = render([
      {
        id: "q1",
        question: "Neden sen?",
        limit: { unit: "chars", max: 20 },
        status: "done",
        text: "React ile panel geliştirdim, %60 hızlandırdım.",
        verification: { status: "flagged", issues: [{ kind: "number_mismatch", detail: "\"60\" CV'nde yok." }] },
        createdAt: "",
      },
    ])
    expect(html).toContain("Neden sen?")
    expect(html).toContain("46/20 karakter")
    expect(html).toContain("sınırı aşıyor")
    expect(html).toContain("Kontrol et")
    expect(html).toContain("Kopyala")
  })

  it("offers the form while there are answers left", () => {
    expect(render([])).toContain("Yanıtla")
  })
})
