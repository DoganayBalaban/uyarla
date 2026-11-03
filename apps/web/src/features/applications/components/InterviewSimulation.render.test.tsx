import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import type { SimulationRecord } from "@uyarla/core/interview/simulationRecord"
import { Conversation, Report } from "@/features/applications/components/InterviewSimulation"
import type { SimulationData } from "@/features/applications/simulationApi"

const at = "2026-11-03T12:00:00Z"
const DATA: SimulationData = { position: "Frontend Geliştirici", company: "Örnek AŞ", language: "tr", ready: true, simulations: [], simulationsLeft: 2 }
const render = (simulation: SimulationRecord) =>
  renderToStaticMarkup(<Conversation simulation={simulation} data={DATA} busy={false} onAction={async () => true} />)

describe("InterviewSimulation (DOG-172)", () => {
  it("shows Deniz typing only while the interviewer's turn is in the queue", () => {
    const writing = render({ id: "s1", phase: "interviewer", messages: [], createdAt: at })
    expect(writing).toContain("Deniz yazıyor")
    expect(writing).not.toContain("Cevabın")
    const failed = render({ id: "s1", phase: "interviewer", failed: true, messages: [], createdAt: at })
    expect(failed).not.toContain("Deniz yazıyor")
    expect(failed).toContain("Tekrar dene")
  })

  it("counts main questions and opens the answer box on the candidate's turn", () => {
    const html = render({
      id: "s1",
      phase: "candidate",
      createdAt: at,
      messages: [
        { role: "interviewer", text: "Merhaba, ben Deniz. Kendinizi anlatır mısınız?", move: "question", createdAt: at },
        { role: "candidate", text: "React geliştiricisiyim.", createdAt: at },
        { role: "interviewer", text: "Bunu nasıl ölçtünüz?", move: "follow_up", createdAt: at },
      ],
    })
    expect(html).toContain("Soru 1 / 5")
    expect(html).toContain("Bunu nasıl ölçtünüz?")
    expect(html).toContain('aria-label="Cevabın"')
  })

  it("leaves STAR out of the introduction question and shows off-paper claims", () => {
    const answer = { answer: "x", star: { situation: false, task: false, action: false, result: false }, strength: null, improvement: "Bir örnek ver.", words: 1 }
    const html = renderToStaticMarkup(
      <Report
        report={{
          answers: [
            { ...answer, question: "Kendinizi anlatır mısınız?", offPaper: [] },
            { ...answer, question: "Ekibi nasıl yönettiniz?", offPaper: ['Cevabında "8" sayısı geçiyor ama CV\'nde yok.'] },
          ],
          strengths: [],
          improvements: ["Payını belirt."],
        }}
      />,
    )
    expect(html.match(/Durum/g)).toHaveLength(1)
    expect(html).toContain("Payını belirt.")
    expect(html).toContain("CV&#x27;nde yok")
  })
})
