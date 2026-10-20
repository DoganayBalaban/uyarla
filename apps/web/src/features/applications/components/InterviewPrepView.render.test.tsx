import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PrepSections } from "@/features/applications/components/InterviewPrepView"

describe("PrepSections (DOG-118)", () => {
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
