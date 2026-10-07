import type { EmbeddingProvider } from "../llm/types.js"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { collectEvidence } from "../score/evidence.js"
import { conceptTexts, score } from "../score/score.js"
import { applyAdaptation } from "./profile.js"

/**
 * Kabul edilen içerikten yeni skoru hesaplar (spec §10).
 *
 * Yeni LLM çağrısı yok — imzada `LlmProvider` bile geçmiyor. Çıkarım Sprint
 * 1'de yapıldı; burada değişen tek şey kanıt kümesi.
 *
 * Skorun yükselmesi garanti değil ve bu dürüstçe yansıtılıyor: yeniden ifade
 * gerçekten eşleşme kazandırmadıysa skor da değişmiyor.
 */
export async function rescore(
  input: { profile: ResumeProfile; posting: JobPostingData; draft: AdaptationDraft },
  embedding: EmbeddingProvider,
): Promise<number> {
  const adapted = applyAdaptation(input.profile, input.draft)
  const evidenceList = collectEvidence(adapted)
  const evidenceTexts = evidenceList.map((k) => k.text)
  const conceptTextList = conceptTexts(input.posting)

  // Tek toplu çağrı: kanıtlar önce, kavramlar sonra (Sprint 1'deki sıra).
  const vecs = await embedding.embed([...evidenceTexts, ...conceptTextList])

  return score({
    profile: adapted,
    posting: input.posting,
    evidence: evidenceList,
    evidenceVectors: vecs.slice(0, evidenceTexts.length),
    conceptVectors: vecs.slice(evidenceTexts.length),
  }).score
}

/**
 * Özet yazımı skoru düşürüyorsa özgün özet kalıyor (kullanıcı kararı,
 * 6 Ekim 2026). Terimleri koruyan bir yazım bile cümleleri değiştirdiği
 * için eşiğe yakın anlamsal eşleşmeleri kaybettirebiliyor; kullanıcı
 * uyarladıktan sonra "-2" görmesin. Maddeler aynı kalıyor, yalnızca özetin
 * iki hâli karşılaştırılıyor.
 */
export async function guardSummaryScore(
  input: { profile: ResumeProfile; posting: JobPostingData; draft: AdaptationDraft },
  embedding: EmbeddingProvider,
): Promise<{ draft: AdaptationDraft; dropped: { withRewrite: number; withOriginal: number } | null }> {
  const { draft, profile, posting } = input
  const original = profile.summary
  if (!original || draft.summary.decision !== "accepted" || draft.summary.rewritten === original) {
    return { draft, dropped: null }
  }
  const reverted: AdaptationDraft = { ...draft, summary: { ...draft.summary, rewritten: original } }

  // İki hâl tek gömme çağrısıyla puanlanıyor: OpenAI gömmeleri çağrıdan
  // çağrıya ~1e-2 oynuyor ve ayrı çağrılar eşiğe yakın bir eşleşmeyi bir
  // tarafta kazandırıp diğerinde kaybettirerek kararı gürültüye bırakırdı.
  const variants = [draft, reverted].map((d) => {
    const adapted = applyAdaptation(profile, d)
    return { adapted, evidence: collectEvidence(adapted) }
  })
  const conceptTextList = conceptTexts(posting)
  const texts = [...new Set([...variants.flatMap((v) => v.evidence.map((e) => e.text)), ...conceptTextList])]
  const vectors = await embedding.embed(texts)
  const vectorOf = new Map(texts.map((text, i) => [text, vectors[i]!]))

  const [withRewrite, withOriginal] = variants.map(
    (v) =>
      score({
        profile: v.adapted,
        posting,
        evidence: v.evidence,
        evidenceVectors: v.evidence.map((e) => vectorOf.get(e.text)!),
        conceptVectors: conceptTextList.map((t) => vectorOf.get(t)!),
      }).score,
  ) as [number, number]

  return withRewrite < withOriginal
    ? { draft: reverted, dropped: { withRewrite, withOriginal } }
    : { draft, dropped: null }
}
