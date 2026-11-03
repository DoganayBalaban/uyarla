/**
 * Mülakat simülasyonu kaydının tipleri ve görüşmenin akışı (DOG-172).
 * Tarayıcı da kullanıyor; istem ve doğrulama koduna bağımlı değil.
 *
 * Akışı model değil kod yönetiyor: kaç ana soru soruldu, ek soru hakkı kaldı
 * mı, kapanışa geçildi mi. Model yalnızca o adımın mesajını yazıyor.
 */

/** Görüşmecinin adı; kendini bununla tanıtıyor. */
export const INTERVIEWER_NAME = "Deniz"

/** Tanışma sorusu dahil ana soru sayısı. */
export const SIMULATION_MAIN_QUESTIONS = 5
/** Bir ana soruya en çok bu kadar ek soru. */
export const SIMULATION_MAX_FOLLOW_UPS = 1
/** Başvuru başına başlatılabilecek simülasyon (başarısız açılış sayılmıyor). */
export const MAX_SIMULATIONS_PER_APPLICATION = 3
export const SIMULATION_MESSAGE_MAX_LENGTH = 3000

/** Görüşmecinin mesajının türü. */
export type InterviewerMove = "question" | "follow_up" | "closing" | "farewell"

export interface SimulationMessage {
  role: "interviewer" | "candidate"
  text: string
  createdAt: string
  /** Yalnızca görüşmecide. */
  move?: InterviewerMove
  /** Yalnızca adayda: cevapta geçen ama CV'de olmayan sayı ya da ilan terimi (worker yazıyor). */
  offPaper?: string[]
}

/**
 * interviewer: görüşmeci yazıyor (iş kuyrukta). candidate: adayın sırası.
 * report: geri bildirim yazılıyor. done: bitti.
 */
export type SimulationPhase = "interviewer" | "candidate" | "report" | "done"

export interface SimulationAnswerReview {
  question: string
  /** Adayın bu soruya ve ek sorusuna verdiği cevaplar, birleşik. */
  answer: string
  star: { situation: boolean; task: boolean; action: boolean; result: boolean }
  strength: string | null
  improvement: string | null
  words: number
  offPaper: string[]
}

export interface SimulationReport {
  answers: SimulationAnswerReview[]
  strengths: string[]
  improvements: string[]
}

export interface SimulationRecord {
  id: string
  phase: SimulationPhase
  /** Son iş düştü; aynı adım yeniden denenebiliyor. */
  failed?: boolean
  messages: SimulationMessage[]
  report?: SimulationReport
  createdAt: string
  finishedAt?: string
}

/** `Analysis.interviewSimulations` JSON'unu okur; bozuk ögeler düşüyor. */
export function readSimulations(value: unknown): SimulationRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (s): s is SimulationRecord =>
      !!s && typeof s === "object" && typeof (s as SimulationRecord).id === "string" && Array.isArray((s as SimulationRecord).messages),
  )
}

/**
 * Görüşmecinin sıradaki adımı.
 *   opening: tanıtma ve ilk soru.
 *   next: ek soru ya da yeni ana soru (model seçiyor).
 *   question: yeni ana soru (ek soru hakkı bitti).
 *   follow_up_or_closing: son ana soru soruldu; ek soru ya da kapanış.
 *   closing: "sormak istediğiniz bir şey var mı?"
 *   farewell: adayın sorusunu cevapla, vedalaş.
 *   report: görüşme bitti.
 */
export type SimulationStep = "opening" | "next" | "question" | "follow_up_or_closing" | "closing" | "farewell" | "report"

export function simulationStep(messages: SimulationMessage[]): SimulationStep {
  const moves = messages.filter((m) => m.role === "interviewer").map((m) => m.move)
  if (moves.length === 0) return "opening"
  const last = moves.at(-1)
  if (last === "farewell") return "report"
  if (last === "closing") return "farewell"
  const asked = moves.filter((m) => m === "question").length
  const followUps = moves.length - 1 - moves.lastIndexOf("question")
  const canFollowUp = followUps < SIMULATION_MAX_FOLLOW_UPS
  if (asked >= SIMULATION_MAIN_QUESTIONS) return canFollowUp ? "follow_up_or_closing" : "closing"
  return canFollowUp ? "next" : "question"
}

const ALLOWED: Record<Exclude<SimulationStep, "report">, InterviewerMove[]> = {
  opening: ["question"],
  next: ["question", "follow_up"],
  question: ["question"],
  follow_up_or_closing: ["follow_up", "closing"],
  closing: ["closing"],
  farewell: ["farewell"],
}

/** Modelin seçtiği tür adımda yoksa adımın asıl türü. */
export function normalizeMove(step: Exclude<SimulationStep, "report">, move: InterviewerMove): InterviewerMove {
  const allowed = ALLOWED[step]
  return allowed.includes(move) ? move : allowed[0]!
}

/** "Soru 2 / 5": şu ana kadar sorulan ana soru. */
export function simulationProgress(messages: SimulationMessage[]): { asked: number; total: number } {
  const asked = messages.filter((m) => m.role === "interviewer" && m.move === "question").length
  return { asked: Math.min(asked, SIMULATION_MAIN_QUESTIONS), total: SIMULATION_MAIN_QUESTIONS }
}

export interface AnswerPair {
  question: string
  /** Ek sorular ve cevapları dahil, sırayla. */
  exchange: Array<{ role: "interviewer" | "candidate"; text: string }>
  answers: SimulationMessage[]
}

/**
 * Her ana soru ve ona (ek sorusu dahil) verilen cevaplar; rapor bunun
 * üstünden. Cevapsız kalan soru düşüyor; kapanış ve veda raporda yok.
 */
export function answerPairs(messages: SimulationMessage[]): AnswerPair[] {
  const pairs: AnswerPair[] = []
  let current: AnswerPair | null = null
  for (const m of messages) {
    if (m.role === "interviewer") {
      if (m.move === "question") {
        current = { question: m.text, exchange: [], answers: [] }
        pairs.push(current)
      } else if (m.move === "follow_up" && current) {
        current.exchange.push({ role: "interviewer", text: m.text })
      } else {
        current = null
      }
    } else if (current) {
      current.exchange.push({ role: "candidate", text: m.text })
      current.answers.push(m)
    }
  }
  return pairs.filter((p) => p.answers.length > 0)
}
