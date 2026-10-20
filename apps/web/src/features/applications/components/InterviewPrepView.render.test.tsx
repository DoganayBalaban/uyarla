import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import { PrepSections } from "@/features/applications/components/InterviewPrepView"

const PREP = {
  questions: [
    {
      question: "Performans iyileştirmesini anlatır mısın?",
      kind: "behavioral" as const,
      why: "",
      evidence: [],
      star: { situation: "", task: "", action: "", result: "" },
      verification: { status: "ok" as const, issues: [] },
    },
  ],
  consistency: [],
  bridges: [],
  askThem: [],
}

describe("PrepSections (DOG-118)", () => {
  it("shows the written practice feedback under its question (DOG-97)", () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <PrepSections
          prep={PREP}
          practice={{
            analysisId: "a1",
            entries: [
              {
                id: "p1",
                questionIndex: 0,
                answer: "Sayfayı hızlandırdım.",
                status: "done",
                createdAt: "",
                feedback: {
                  star: { situation: true, task: true, action: true, result: false },
                  strengths: ["Eylem net."],
                  improvements: ["Sonucu bir ölçüyle bitir."],
                  words: 3,
                  length: "short",
                  offPaper: ["Cevabında \"%60\" geçiyor ama CV'nde yok; sorulursa kanıtlayabilmelisin."],
                },
              },
            ],
          }}
        />
      </QueryClientProvider>,
    )
    expect(html).toContain("Cevabını yaz, geri bildirim al")
    expect(html).toContain("Sonuç<span class=\"sr-only\"> eksik</span>")
    expect(html).toContain("Sonucu bir ölçüyle bitir.")
    expect(html).toContain("biraz kısa")
    expect(html).toContain("%60")
    expect(html).toContain("2 hakkın kaldı")
  })

  it("shows questions with CV evidence, STAR, the claims to defend, bridges and questions to ask", () => {
    const html = renderToStaticMarkup(
      <PrepSections
        prep={{
          questions: [
            {
              question: "Performans iyileştirmesini anlatır mısın?",
              kind: "behavioral",
              why: "CV'nde %40 iyileştirme var.",
              evidence: ["Sayfa yükleme süresini %40 kısalttım"],
              star: { situation: "[proje]", task: "Hızlandırmak", action: "[ne yaptın]", result: "%40" },
              verification: { status: "flagged", issues: [{ kind: "number_mismatch", detail: "Bu paragrafta \"8\" sayısı geçiyor ama CV'nde yok." }] },
            },
          ],
          consistency: [{ claim: "Sayfa yükleme süresini %40 kısalttım", reason: "quantity" }],
          bridges: [{ requirement: "Kubernetes", answer: "Doğrudan çalışmadım.", verification: { status: "ok", issues: [] } }],
          askThem: ["Ekip nasıl çalışıyor?"],
        }}
      />,
    )
    expect(html).toContain("CV&#x27;ndeki dayanağın")
    expect(html).toContain("Davranışsal")
    expect(html).toContain("Kontrol et")
    expect(html).toContain("Savunmaya hazır ol")
    expect(html).toContain("Eksik kalan gereksinimler")
    expect(html).toContain("Senin soracakların")
  })
})
