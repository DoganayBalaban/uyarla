import {
  PermanentError,
  checkFormat,
  TransientError,
  collectEvidence,
  conceptTexts,
  extractJobPosting,
  extractResumeProfile,
  score,
} from "@uyarla/core"
import type { FormatReport } from "@uyarla/core"
import type { AnalysisStore, PipelineDeps, PipelineInput } from "./types.js"

/**
 * analyze işinin aşama sırası (spec §8):
 * çıkarım → embedding → skor → Analysis kaydı.
 *
 * Aşamalar ayrı kuyruk işlerine bölünmüyor: veri akışı doğrusal ve tek
 * kullanıcının tek isteği; bölmek görünürlük kazandırmadan karmaşıklık ekler.
 *
 * Çağrılar sıralı (K-09). Paralelleştirme Görev 13'te eval verisiyle
 * yeniden değerlendirilecek.
 */
export async function runAnalysis(
  deps: PipelineDeps,
  input: PipelineInput,
): Promise<string> {
  const now = deps.now ?? Date.now
  const startedAt = now()

  const analysisId = await deps.store.createAnalysis({
    jobPostingId: input.jobPostingId,
    modelId: deps.modelId,
    userId: input.userId,
  })

  try {
    deps.onProgress?.("cv_okunuyor")
    const resumeText = await deps.store.getResumeText(input.resumeId)
    const format = await formatReport(deps.store, input.resumeId, resumeText)
    const profile = await extractResumeProfile(deps.llm, resumeText)
    const resumeVersionId = await deps.store.saveResumeVersion(input.resumeId, profile.data)
    await deps.store.attachResumeVersion(analysisId, resumeVersionId)

    deps.onProgress?.("ilan_okunuyor")
    const postingText = await deps.store.getJobPostingText(input.jobPostingId)
    const posting = await extractJobPosting(deps.llm, postingText)
    await deps.store.saveJobPostingData(input.jobPostingId, posting.data)

    deps.onProgress?.("karsilastiriliyor")
    const evidence = collectEvidence(profile.data)
    const evidenceTexts = evidence.map((e) => e.text)
    const conceptTerms = conceptTexts(posting.data)

    // Tek toplu çağrı: kanıtlar önce, kavramlar sonra. Sıralama aşağıdaki
    // dilimlemeyle eşleşmek zorunda.
    const vectors = await deps.embedding.embed([...evidenceTexts, ...conceptTerms])

    const result = score({
      profile: profile.data,
      posting: posting.data,
      evidence,
      evidenceVectors: vectors.slice(0, evidenceTexts.length),
      conceptVectors: vectors.slice(evidenceTexts.length),
    })

    await deps.store.completeAnalysis({
      analysisId,
      score: result.score,
      result,
      format,
      durationMs: now() - startedAt,
      tokenUsage: profile.tokens + posting.tokens,
    })

    deps.onProgress?.("tamamlandi")
    return analysisId
  } catch (error) {
    // Başarısız işler de Analysis kaydı yazıyor (spec §11): hangi çiftte ne
    // patlıyor bilgisi K1 değerlendirmesinin parçası.
    try {
      await deps.store.failAnalysis(analysisId, classify(error))
    } catch {
      // Kayıt da düşerse asıl hata gizlenmemeli; teşhisi imkânsız kılar.
    }
    throw error
  }
}

/**
 * CV'nin biçim kontrolü. Yan bilgi: patlarsa analiz durmuyor, skor yine
 * üretiliyor ve arayüz kontrol bölümünü göstermiyor.
 */
async function formatReport(
  store: AnalysisStore,
  resumeId: string,
  text: string,
): Promise<FormatReport | null> {
  try {
    const { buffer, filename } = await store.getResumeFile(resumeId)
    return await checkFormat({ buffer, filename, text })
  } catch (error) {
    console.warn("[pipeline] biçim kontrolü atlandı", error)
    return null
  }
}

function classify(error: unknown): string {
  if (error instanceof PermanentError || error instanceof TransientError) {
    return error.code
  }
  return "unknown"
}
