import {
  AdaptationDraftSchema,
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
  hasPendingDecisions,
  rescore,
  type AdaptationDraft,
  type JobPostingData,
  type ResumeProfile,
} from "@uyarla/core"
import { prisma } from "@uyarla/db"

/**
 * Tek bir maddenin (ya da özetin) kararını değiştirir.
 *
 * Taslağı yerinde değiştirmiyor: aynı nesne hem okunup hem yazılırsa
 * eşzamanlı iki karar birbirini ezer.
 */
export function applyDecision(
  draft: AdaptationDraft,
  itemId: string,
  decision: "accepted" | "rejected",
): AdaptationDraft {
  if (itemId === "summary") {
    return { ...draft, summary: { ...draft.summary, decision } }
  }

  if (!draft.bullets.some((b) => b.id === itemId)) {
    // Sessizce yok saymak, kullanıcının tıkladığı kararın kaybolması olurdu.
    throw new Error(`Madde bulunamadı: ${itemId}`)
  }

  return {
    ...draft,
    bullets: draft.bullets.map((b) => (b.id === itemId ? { ...b, decision } : b)),
  }
}

/** Uyarı taşıyan madde kaldıysa `draft`, kalmadıysa `ready` (K-26). */
export function nextStatus(draft: AdaptationDraft): "draft" | "ready" {
  return hasPendingDecisions(draft) ? "draft" : "ready"
}

/** Uyarlama kaydı ve dayandığı Sprint 1 verisi. */
export async function loadAdaptation(id: string) {
  const adaptation = await prisma.adaptation.findUnique({
    where: { id },
    include: { analysis: { include: { resumeVersion: true, jobPosting: true } } },
  })
  if (!adaptation) return null

  const { analysis } = adaptation
  const profile = (analysis.resumeVersion?.profile ?? null) as ResumeProfile | null
  const posting: JobPostingData = {
    position: analysis.jobPosting.position,
    company: null,
    seniority: analysis.jobPosting.seniority as never,
    language: analysis.jobPosting.language as never,
    requirements: analysis.jobPosting.requirements as never,
  }

  // Kayıt henüz yazılmamışken draft boş bir nesne; parse etmeye çalışmıyoruz.
  const draft: AdaptationDraft | null =
    adaptation.status === "running" || adaptation.status === "failed"
      ? null
      : AdaptationDraftSchema.parse(adaptation.draft)

  return {
    adaptation,
    profile,
    posting,
    draft,
    scoreBefore: analysis.score,
    /** Nihai ResumeVersion'ın bağlanacağı CV; indirme route'u kullanıyor. */
    resumeId: analysis.resumeVersion?.resumeId ?? null,
  }
}

/**
 * Kabul edilen içerikten yeni skoru hesaplar; taslak yoksa null.
 *
 * Veritabanında saklanmıyor: her karar değişikliğinde bayatlar ve maliyeti
 * tek bir toplu gömme çağrısı — LLM yok (spec §10).
 */
export async function computeScoreAfter(
  profile: ResumeProfile | null,
  posting: JobPostingData,
  draft: AdaptationDraft | null,
): Promise<number | null> {
  if (!profile || !draft) return null
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  return rescore({ profile, posting, draft }, embedding)
}
