import { describe, expect, it, vi } from "vitest"
import type { SimulationRecord } from "@uyarla/core"
import type { SimulationContext, SimulationStore } from "./follow-up-store.js"
import { runSimulation } from "./simulation-pipeline.js"

const NOW = new Date("2026-11-03T12:00:00Z")
const at = NOW.toISOString()

const base: Omit<SimulationContext, "simulation"> = {
  profile: { fullName: null, headline: null, summary: null, experience: [], education: [], skills: ["React"], languages: [], certifications: [] },
  coverLetter: [],
  posting: { position: "Geliştirici", company: "Örnek", seniority: null, language: "tr", requirements: [] },
  missingMust: [],
  rewritten: [],
}

/** Kilit altındaki güncellemeyi bellekte taklit ediyor. */
function memoryStore(simulation: SimulationRecord | null) {
  const state = { simulation }
  const store: SimulationStore = {
    getContext: async () => ({ ...base, simulation: state.simulation }),
    update: vi.fn(async (_a, _s, change) => {
      if (!state.simulation) return null
      const next = change(state.simulation)
      if (next) state.simulation = next
      return next
    }),
  }
  return { store, state }
}

const llmReturning = (...data: unknown[]) => {
  const extract = vi.fn()
  for (const d of data) extract.mockResolvedValueOnce({ data: d, tokens: 1 })
  return { extract } as never
}

const sim = (patch: Partial<SimulationRecord>): SimulationRecord => ({ id: "s1", phase: "interviewer", messages: [], createdAt: at, ...patch })

describe("runSimulation (DOG-172)", () => {
  it("writes the interviewer's opening and hands the turn to the candidate", async () => {
    const { store, state } = memoryStore(sim({}))
    await runSimulation({ llm: llmReturning({ mesaj: "Merhaba, ben Deniz.", hamle: "soru" }), store, now: () => NOW }, { analysisId: "a1", simulationId: "s1" })
    expect(state.simulation).toMatchObject({ phase: "candidate", messages: [{ role: "interviewer", text: "Merhaba, ben Deniz.", move: "question" }] })
  })

  it("marks off-paper claims on the candidate's last answer", async () => {
    const messages = [
      { role: "interviewer" as const, text: "Anlatır mısınız?", move: "question" as const, createdAt: at },
      { role: "candidate" as const, text: "12 kişilik ekibi yönettim.", createdAt: at },
    ]
    const { store, state } = memoryStore(sim({ messages }))
    await runSimulation({ llm: llmReturning({ mesaj: "Ekibi nasıl yönettiniz?", hamle: "ek_soru" }), store, now: () => NOW }, { analysisId: "a1", simulationId: "s1" })
    expect(state.simulation!.messages[1]!.offPaper).toHaveLength(1)
    expect(state.simulation!.messages[2]).toMatchObject({ move: "follow_up" })
  })

  it("writes the report right after the farewell", async () => {
    const messages = [
      { role: "interviewer" as const, text: "Kendinizi anlatır mısınız?", move: "question" as const, createdAt: at },
      { role: "candidate" as const, text: "React geliştiricisiyim.", createdAt: at },
      { role: "interviewer" as const, text: "Sorunuz var mı?", move: "closing" as const, createdAt: at },
      { role: "candidate" as const, text: "Yok, teşekkürler.", createdAt: at },
    ]
    const { store, state } = memoryStore(sim({ messages }))
    const llm = llmReturning(
      { mesaj: "Teşekkürler, iyi günler.", hamle: "veda" },
      { cevaplar: [{ star: { durum: false, gorev: false, eylem: false, sonuc: false }, guclu: "", gelistir: "Bir örnek ver." }], guclu: [], gelistir: [] },
    )
    await runSimulation({ llm, store, now: () => NOW }, { analysisId: "a1", simulationId: "s1" })
    expect(state.simulation).toMatchObject({ phase: "done", finishedAt: at, report: { answers: [{ improvement: "Bir örnek ver." }] } })
  })

  it("does not write over a record that changed meanwhile, or one waiting for the candidate", async () => {
    const { store, state } = memoryStore(sim({}))
    const llm = { extract: vi.fn(async () => {
      state.simulation = { ...state.simulation!, messages: [{ role: "interviewer", text: "x", move: "question", createdAt: at }], phase: "candidate" }
      return { data: { mesaj: "Merhaba", hamle: "soru" }, tokens: 1 }
    }) }
    await runSimulation({ llm: llm as never, store, now: () => NOW }, { analysisId: "a1", simulationId: "s1" })
    expect(state.simulation!.messages).toHaveLength(1)

    const waiting = memoryStore(sim({ phase: "candidate" }))
    const untouched = { extract: vi.fn() }
    await runSimulation({ llm: untouched as never, store: waiting.store }, { analysisId: "a1", simulationId: "s1" })
    expect(untouched.extract).not.toHaveBeenCalled()
  })
})
