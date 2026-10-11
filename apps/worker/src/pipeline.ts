import {
  PermanentError,
  checkFormat,
  TransientError,
  collectEvidence,
  conceptTexts,
  extractJobPosting,
  extractResumeProfile,
  resumeParserKey,
  score,
} from "@uyarla/core"
import type { FormatReport, ResumeProfile } from "@uyarla/core"
import type { AnalysisStore, PipelineDeps, PipelineInput } from "./types.js"

/**
 * analyze işinin aşama sırası (spec §8):
 * çıkarım → embedding → skor → Analysis kaydı.
 *
 * Aşamalar ayrı kuyruk işlerine bölünmüyor: veri akışı doğrusal ve tek
 * kullanıcının tek isteği; bölmek görünürlük kazandırmadan karmaşıklık ekler.
 *
 * CV ve ilan aynı anda okunuyor (DOG-28). K-09'da yerel model tek istek
 * işleyebildiği için sıralıydı; barındırılan modelde ikisi birbirini
 * beklemiyor.
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
    deps.onProgress?.("reading_resume")
    const readResume = async () => {
      const resume = await readResumeProfile(deps, input.resumeId)
      await deps.store.attachResumeVersion(analysisId, resume.versionId)
      // İlan hâlâ okunuyorsa arayüz ikinci aşamayı göstersin.
      deps.onProgress?.("reading_posting")
      return resume
    }
    const readPosting = async () => {
      const postingText = await deps.store.getJobPostingText(input.jobPostingId)
      const extracted = await extractJobPosting(deps.llm, postingText)
      await deps.store.saveJobPostingData(input.jobPostingId, extracted.data)
      return extracted
    }
    const [resume, posting] = await Promise.all([readResume(), readPosting()])
    const profile = { data: resume.profile, tokens: resume.tokens }

    deps.onProgress?.("comparing")
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
      format: resume.format,
      durationMs: now() - startedAt,
      tokenUsage: profile.tokens + posting.tokens,
    })

    deps.onProgress?.("completed")
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
 * CV'nin metni, biçim kontrolü ve ayrıştırılmış profili.
 *
 * Kütüphaneden seçilen CV aynı model ve prompt'larla daha önce ayrıştırıldıysa
 * o profil kullanılıyor ve LLM çağrısı yapılmıyor (DOG-59). Böylece aynı CV
 * farklı ilanlarda aynı profille puanlanıyor ve en pahalı aşama atlanıyor.
 */
async function readResumeProfile(
  deps: PipelineDeps,
  resumeId: string,
): Promise<{ profile: ResumeProfile; versionId: string; tokens: number; format: FormatReport | null }> {
  const resumeText = await deps.store.getResumeText(resumeId)
  const parserKey = resumeParserKey(deps.modelId)

  const parse = async () => {
    const parsed = await deps.store.findParsedVersion(resumeId, parserKey)
    if (parsed) return { profile: parsed.profile, versionId: parsed.id, tokens: 0 }
    const extracted = await extractResumeProfile(deps.llm, resumeText)
    const versionId = await deps.store.saveResumeVersion(resumeId, extracted.data, parserKey)
    return { profile: extracted.data, versionId, tokens: extracted.tokens }
  }
  // Biçim kontrolü dosyayı depodan okuyor; ayrıştırmayı beklemesine gerek yok.
  const [format, profile] = await Promise.all([formatReport(deps.store, resumeId, resumeText), parse()])
  return { ...profile, format }
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
