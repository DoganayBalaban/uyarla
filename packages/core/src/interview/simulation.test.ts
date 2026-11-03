import { describe, expect, it, vi } from "vitest"
import type { LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { interviewerTurn, questionTopic, simulationReport } from "./simulation.js"
import { SIMULATION_MAIN_QUESTIONS, answerPairs, normalizeMove, simulationProgress, simulationStep, type SimulationMessage } from "./simulationRecord.js"

const PROFILE: ResumeProfile = {
  fullName: "Ece Yılmaz",
  headline: null,
  summary: null,
  experience: [
    { company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen", bullets: [{ text: "Sayfa yükleme süresini %40 kısalttım", sourceRef: "Sayfa yükleme süresini %40 kısalttım" }] },
  ],
  education: [],
  skills: ["React"],
  languages: [],
  certifications: [],
}
const POSTING = {
  position: "Frontend Geliştirici",
  company: "Örnek AŞ",
  seniority: "mid",
  language: "tr",
  requirements: [{ text: "Kubernetes", type: "skill", importance: "must", concepts: [{ term: "kubernetes", synonyms: [] }] }],
} as JobPostingData

const NOW = new Date("2026-11-03T12:00:00Z")
const at = NOW.toISOString()
const deniz = (move: SimulationMessage["move"], text = "Soru?"): SimulationMessage => ({ role: "interviewer", text, move, createdAt: at })
const aday = (text = "Cevap."): SimulationMessage => ({ role: "candidate", text, createdAt: at })

/** n ana soru, her biri cevaplı. */
const asked = (n: number) => Array.from({ length: n }, () => [deniz("question"), aday()]).flat()

function fakeLlm(data: unknown) {
  const extract = vi.fn<LlmProvider["extract"]>(async <T>() => ({ data: data as T, tokens: 7 }))
  return { llm: { extract } as LlmProvider, extract }
}

describe("simulationStep (DOG-172)", () => {
  it("opens, then lets the model pick a follow-up or a new question", () => {
    expect(simulationStep([])).toBe("opening")
    expect(simulationStep(asked(1))).toBe("next")
  })

  it("allows one follow-up per main question", () => {
    expect(simulationStep([...asked(2), deniz("follow_up"), aday()])).toBe("question")
  })

  it("moves to closing after the last main question and its follow-up", () => {
    const all = asked(SIMULATION_MAIN_QUESTIONS)
    expect(simulationStep(all)).toBe("follow_up_or_closing")
    expect(simulationStep([...all, deniz("follow_up"), aday()])).toBe("closing")
  })

  it("says farewell after the candidate answers the closing question, then the report", () => {
    const closed = [...asked(SIMULATION_MAIN_QUESTIONS), deniz("closing"), aday("Sorum yok.")]
    expect(simulationStep(closed)).toBe("farewell")
    expect(simulationStep([...closed, deniz("farewell")])).toBe("report")
  })
})

describe("normalizeMove", () => {
  it("keeps an allowed move and replaces one the step does not allow", () => {
    expect(normalizeMove("next", "follow_up")).toBe("follow_up")
    expect(normalizeMove("next", "closing")).toBe("question")
    expect(normalizeMove("question", "follow_up")).toBe("question")
    expect(normalizeMove("follow_up_or_closing", "question")).toBe("follow_up")
  })
})

describe("simulationProgress", () => {
  it("counts main questions, not follow-ups", () => {
    expect(simulationProgress([...asked(2), deniz("follow_up")])).toEqual({ asked: 2, total: SIMULATION_MAIN_QUESTIONS })
  })
})

describe("answerPairs", () => {
  it("joins a follow-up and its answer to the main question and drops unanswered ones", () => {
    const pairs = answerPairs([deniz("question", "S1"), aday("C1"), deniz("follow_up", "E1"), aday("C1b"), deniz("question", "S2")])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]!.question).toBe("S1")
    expect(pairs[0]!.exchange).toEqual([
      { role: "candidate", text: "C1" },
      { role: "interviewer", text: "E1" },
      { role: "candidate", text: "C1b" },
    ])
  })

  it("leaves the closing exchange out", () => {
    expect(answerPairs([deniz("question"), aday(), deniz("closing"), aday("Sorum var.")])[0]!.answers).toHaveLength(1)
  })
})

describe("interviewerTurn", () => {
  const input = { profile: PROFILE, posting: POSTING, missingMust: ["Kubernetes"], messages: [] as SimulationMessage[] }

  it("introduces itself by name and knows the posting, the CV and the gaps", async () => {
    const { llm, extract } = fakeLlm({ mesaj: "Merhaba, ben Deniz.", hamle: "soru" })
    const { data } = await interviewerTurn(llm, input, NOW)
    expect(data.message).toEqual({ role: "interviewer", text: "Merhaba, ben Deniz.", move: "question", createdAt: at })
    const call = extract.mock.calls[0]![0]
    expect(call.prompt).toMatch(/Sen Deniz'sin/)
    expect(call.input).toContain("Şirket: Örnek AŞ")
    expect(call.input).toContain("Kubernetes (zorunlu)")
    expect(call.input).toContain("Sayfa yükleme süresini %40 kısalttım")
    expect(call.input).toMatch(/CV'DE KARŞILIĞI OLMAYAN ZORUNLU GEREKSİNİMLER\n- Kubernetes/)
    expect(call.input).toMatch(/kendini adınla tanıt/)
    expect(call.input).toMatch(/Konusu: tanışma/)
    expect(call.temperature).toBeGreaterThan(0)
  })

  it("passes off-paper claims in the last answer so the interviewer can probe them", async () => {
    const { llm, extract } = fakeLlm({ mesaj: "Bunu nasıl ölçtünüz?", hamle: "ek_soru" })
    const { data } = await interviewerTurn(llm, { ...input, messages: [deniz("question"), aday("8 kişilik ekibi yönettim.")] }, NOW)
    expect(data.message.move).toBe("follow_up")
    expect(data.lastAnswerOffPaper).toEqual(['Cevabında "8" sayısı geçiyor ama CV\'nde yok; sorulursa kanıtlayabilmelisin.'])
    expect(extract.mock.calls[0]![0].input).toMatch(/SON CEVAPTA CV'DE OLMAYAN İDDİALAR\n- Cevabında "8"/)
  })

  it("forces the move the step requires", async () => {
    const { llm } = fakeLlm({ mesaj: "Sorunuz var mı?", hamle: "kapanis" })
    const { data } = await interviewerTurn(llm, { ...input, messages: asked(1) }, NOW)
    expect(data.message.move).toBe("question")
  })

  it("refuses to write after the farewell", async () => {
    const { llm } = fakeLlm({ mesaj: "x", hamle: "veda" })
    await expect(interviewerTurn(llm, { ...input, messages: [deniz("farewell")] }, NOW)).rejects.toThrow()
  })
})

describe("questionTopic", () => {
  it("plans a claim, a behavioral and a gap question, falling back to a requirement", () => {
    expect(questionTopic(3, { claims: 2, missing: 1 })).toMatch(/ÜSTÜNE GİDİLECEK İDDİALAR/)
    expect(questionTopic(4, { claims: 2, missing: 1 })).toMatch(/davranışsal/)
    expect(questionTopic(5, { claims: 2, missing: 1 })).toMatch(/KARŞILIĞI OLMAYAN/)
    expect(questionTopic(3, { claims: 0, missing: 0 })).toMatch(/henüz sormadığın bir gereksinimi/)
    expect(questionTopic(5, { claims: 0, missing: 0 })).toMatch(/henüz sormadığın bir gereksinimi/)
  })

  it("tells the model the topic of the next main question", async () => {
    const { llm, extract } = fakeLlm({ mesaj: "Bir keresinde…", hamle: "soru" })
    await interviewerTurn(llm, { profile: PROFILE, posting: POSTING, missingMust: [], messages: [...asked(3), deniz("follow_up"), aday()] }, NOW)
    expect(extract.mock.calls[0]![0].input).toMatch(/Konusu: davranışsal soru/)
  })
})

describe("simulationReport", () => {
  it("pairs the model's reading with words and off-paper claims from code", async () => {
    const { llm } = fakeLlm({
      cevaplar: [{ star: { durum: true, gorev: true, eylem: true, sonuc: false }, guclu: "Durumu net kurdun.", gelistir: "Sonucu söyle." }],
      guclu: ["Kısa ve net."],
      gelistir: ["Payını belirt.", ""],
    })
    const { data } = await simulationReport(llm, { profile: PROFILE, posting: POSTING, messages: [deniz("question", "S1"), aday("Kubernetes kümesini yönettim, 3 kat hızlandı.")] })
    expect(data.answers).toHaveLength(1)
    expect(data.answers[0]).toMatchObject({ question: "S1", strength: "Durumu net kurdun.", improvement: "Sonucu söyle.", words: 6 })
    expect(data.answers[0]!.offPaper.length).toBeGreaterThan(0)
    expect(data.improvements).toEqual(["Payını belirt."])
  })

  it("skips the model when nothing was answered", async () => {
    const { llm, extract } = fakeLlm({})
    const { data } = await simulationReport(llm, { profile: PROFILE, posting: POSTING, messages: [deniz("question")] })
    expect(data.answers).toEqual([])
    expect(extract).not.toHaveBeenCalled()
  })
})
