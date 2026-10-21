import { generateInterviewPrep, reviewAnswer } from "@uyarla/core"
import type { LlmProvider } from "@uyarla/core"
import type { InterviewPrepJobData, PracticeJobData } from "./adapt-queue.js"
import type { InterviewPrepStore } from "./follow-up-store.js"

/**
 * Mülakat hazırlık paketi (DOG-118). Kaynak başvurunun gönderilen hâli;
 * kanıtlar CV'de birebir, STAR ve köprüler doğrulanmış. Yeniden denenen iş
 * bitmiş bir paketi bir daha yazmıyor.
 */
export async function runInterviewPrep(deps: { llm: LlmProvider; store: InterviewPrepStore }, input: InterviewPrepJobData): Promise<void> {
  const context = await deps.store.getPrepContext(input.analysisId)
  if (!context.record || context.record.status !== "running") return
  // Belgeler okundu; adım kayda yazılıyor, ekran bunu gösteriyor (DOG-136).
  await deps.store.updatePrep(input.analysisId, (current) =>
    current?.status === "running" ? { ...current, stage: "writing" } : current,
  )
  const { data } = await generateInterviewPrep(deps.llm, {
    profile: context.profile,
    coverLetter: context.coverLetter,
    posting: context.posting,
    missingMust: context.missingMust,
    rewritten: context.rewritten,
  })
  // Bu arada eklenen pratik denemeleri korunuyor.
  await deps.store.updatePrep(input.analysisId, (current) => {
    if (!current) return null
    const { stage: _stage, ...rest } = current as typeof current & { stage?: unknown }
    return { ...rest, status: "done", prep: data }
  })
}

/**
 * Yazılı pratik (DOG-97): bir cevaba geri bildirim. Kaynak yine gönderilen
 * belgeler; "kağıtta yok" kodda.
 */
export async function runPractice(deps: { llm: LlmProvider; store: InterviewPrepStore }, input: PracticeJobData): Promise<void> {
  const context = await deps.store.getPrepContext(input.analysisId)
  const entry = context.record?.practice?.find((p) => p.id === input.practiceId)
  const question = entry ? context.record?.prep?.questions[entry.questionIndex] : undefined
  if (!entry || entry.status !== "running" || !question) return
  const { data } = await reviewAnswer(deps.llm, {
    question: question.question,
    answer: entry.answer,
    profile: context.profile,
    coverLetter: context.coverLetter,
    posting: context.posting,
  })
  await deps.store.updatePrep(input.analysisId, (current) =>
    current
      ? { ...current, practice: (current.practice ?? []).map((p) => (p.id === input.practiceId ? { ...p, status: "done" as const, feedback: data } : p)) }
      : null,
  )
}
