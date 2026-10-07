import { cosineSimilarity } from "../llm/embedding.js"
import { guardSummaryScore } from "./rescore.js"
import { resumeLanguage } from "../normalize/language.js"
import type { EmbeddingProvider, LlmProvider } from "../llm/types.js"
import {
  AdaptationDraftSchema,
  type AdaptationDraft,
  type AdaptedBullet,
  type Verification,
} from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { conceptTexts, type ScoreResult } from "../score/score.js"
import { DEFAULT_ALIGNMENT_CONFIG, verifyAlignments, type AlignmentConfig } from "../verify/alignment.js"
import { preservesSource, summaryAnchors } from "../verify/preserve.js"
import { verifyRewrite } from "../verify/verify.js"
import { bulletId } from "./profile.js"
import { rewriteBullets, rewriteSummary } from "./rewrite.js"
import { orderSkillsForPosting } from "./skills.js"
import {
  DEFAULT_TARGET_OPTIONS,
  alignmentTargets,
  resumeText,
  skillsFromBullets,
  supportedConceptTerms,
  type TargetOptions,
} from "./targets.js"

export interface DraftInput {
  llm: LlmProvider
  embedding: EmbeddingProvider
  profile: ResumeProfile
  posting: JobPostingData
  /** Analizin skor sonucu; hangi kavramların açık olduğunu söylüyor. */
  result: ScoreResult
  /** Madde yazımları başlarken ve doğrulamaya geçerken çağrılır. */
  onStage?: (stage: "rewriting" | "verifying") => void
  targetOptions?: TargetOptions
  alignmentConfig?: AlignmentConfig
  /**
   * Yazılıp önerilmeyen her madde için çağrılır. Ürün bunu kullanmıyor;
   * değerlendirme betiği hangi kuralın ne kadar yazım attığını ölçüyor.
   */
  onDiscard?: (discard: Discard) => void
}

export interface Discard {
  /** Madde kimliği; özet için "summary". */
  id: string
  reason: DiscardReason
  /** Kuralın gerekçesi: kaybolan ifade ya da doğrulama uyarıları. */
  detail: string
  rewritten: string
}

/** Yazımın neden atıldığı: bilgi kaybı, doğrulama uyarısı, uyumsuz değişiklik. */
export type DiscardReason = "not_preserved" | "flagged" | "unaligned" | "score_drop"

const CLEAN: Verification = { status: "ok", issues: [] }

/**
 * Uyarlama taslağını üretir: hedef seçimi → yazım → doğrulama.
 *
 * Worker hattı ve değerlendirme betiği aynı işi yapıyordu ve ikisi ayrı ayrı
 * bakım gerektiriyordu; tek yerde toplandı (K-38).
 */
export async function buildAdaptationDraft(
  input: DraftInput,
): Promise<{ draft: AdaptationDraft; tokens: number }> {
  const { llm, embedding, profile, posting, result } = input
  const alignmentCfg = input.alignmentConfig ?? DEFAULT_ALIGNMENT_CONFIG

  const bulletList = profile.experience.flatMap((job, i) =>
    job.bullets.map((bullet, j) => ({
      id: bulletId(i, j),
      experienceIndex: i,
      original: bullet.text,
      sourceRef: bullet.sourceRef,
    })),
  )

  // 1. Hedefler: her maddeye anlamca yakın, henüz karşılanmamış ilan terimleri.
  const conceptTextList = conceptTexts(posting)
  const targetVectors = await embedding.embed([
    ...bulletList.map((m) => m.original),
    ...conceptTextList,
  ])
  // Terim uyumu yalnızca CV ile ilan aynı dildeyse: Türkçe bir ilan
  // terimini İngilizce bir maddeye yazdırmak çeviri olur, kelime düzeyinde
  // doğrulanamaz ve adayın CV'sinin dilini bozar (K-39). Özet yazımı
  // etkilenmiyor; ona verilen terimler CV'nin kendi metninden geliyor.
  const lang = resumeLanguage(profile)
  const sameLanguage = lang === posting.language
  const allTargets = alignmentTargets(
    {
      bullets: bulletList.map((m) => m.original),
      bulletVectors: targetVectors.slice(0, bulletList.length),
      posting,
      conceptVectors: targetVectors.slice(bulletList.length),
      result,
    },
    input.targetOptions ?? DEFAULT_TARGET_OPTIONS,
  )
  const targetList = sameLanguage ? allTargets : allTargets.map(() => [])

  // 2. Yazım.
  input.onStage?.("rewriting")
  const fullResumeText = resumeText(profile)
  const [rewrites, summaryText] = await Promise.all([
    rewriteBullets(
      llm,
      bulletList.map((m, i) => ({
        bullet: m.original,
        targets: targetList[i]!.map((h) => h.label),
        language: lang,
      })),
    ),
    profile.summary
      ? rewriteSummary(llm, {
          summary: profile.summary,
          posting,
          supportedTerms: supportedConceptTerms(posting, fullResumeText),
          // Doğrulama da aynı listeyi istiyor (preservesSource bases).
          keepTerms: summaryAnchors(profile.summary, profile.skills),
          language: lang,
        })
      : Promise.resolve(null),
  ])

  // 3. Doğrulama. Tek toplu gömme: yazımlar, kaynaklar, sonra her uyumun
  // terimi ve dayanağı. Sıra aşağıdaki dilimlemeyle eşleşmek zorunda.
  input.onStage?.("verifying")
  const newTexts = bulletList.map((m, i) => rewrites[i]?.data.text ?? m.original)
  const claims = bulletList.flatMap((_, i) =>
    (rewrites[i]?.data.alignments ?? []).map((a) => ({ bulletItem: i, ...a })),
  )
  const vecs = await embedding.embed([
    ...newTexts,
    ...bulletList.map((m) => m.sourceRef),
    ...claims.map((a) => a.term),
    ...claims.map((a) => a.basis),
  ])
  const n = bulletList.length
  const k = claims.length
  const similarityScore = (j: number) => {
    const a = vecs[2 * n + j]
    const b = vecs[2 * n + k + j]
    return a && b ? cosineSimilarity(a, b) : 0
  }

  const bullets: AdaptedBullet[] = bulletList.map((bulletItem, i) => {
    const fresh = newTexts[i]!
    // Yazılmayan (hedefsiz ya da patlayan) madde doğrulamaya sokulmuyor:
    // kullanıcının kendi cümlesini uyarmak anlamsız (spec §13).
    if (!rewrites[i] || fresh === bulletItem.original) {
      return { ...bulletItem, rewritten: bulletItem.original, verification: CLEAN, alignments: [], decision: "accepted" }
    }

    const bulletClaims = claims
      .map((a, j) => ({ ...a, j }))
      .filter((a) => a.bulletItem === i)
    const verified = verifyAlignments(
      {
        alignments: bulletClaims.map(({ term, basis }) => ({ term, basis })),
        source: bulletItem.sourceRef,
        targets: targetList[i]!.map((h) => h.concept),
        similarities: bulletClaims.map((a) => similarityScore(a.j)),
      },
      alignmentCfg,
    )

    // Bilgi kaybeden yazım gösterilmiyor bile: madde olduğu gibi kalıyor.
    // Kullanıcıya bozuk bir cümle gösterip reddettirmek yerine hiç önermemek
    // daha dürüst ve daha az yorucu (verify/preserve.ts).
    const preserved = preservesSource({
      rewritten: fresh,
      source: bulletItem.sourceRef,
      posting,
      bases: verified.map((d) => d.basis),
    })
    if (!preserved.ok) {
      input.onDiscard?.({ id: bulletItem.id, reason: "not_preserved", detail: preserved.reason, rewritten: fresh })
      return { ...bulletItem, rewritten: bulletItem.original, verification: CLEAN, alignments: [], decision: "accepted" }
    }

    const verification = verifyRewrite({
      rewritten: fresh,
      source: bulletItem.sourceRef,
      posting,
      vectors: { rewritten: vecs[i]!, source: vecs[n + i]! },
      allowedTerms: verified.map((d) => d.concept.term),
    })

    // Uydurma, sayı ya da sapma uyarısı alan yazım da önerilmiyor. K-26'da
    // uyarılı madde kullanıcıya gösterilip karara bırakılıyordu; ama artık
    // yalnızca hedefi olan maddeler yazılıyor ve uyarılı bir yazım başarısız
    // bir denemedir. Uçtan uca testte bu, "…bütçeyi optimize ederek Bütçe
    // yönetimi gerçekleştirdim" gibi reddedilmesi kesin cümleleri kullanıcının
    // önüne koyuyordu (K-38).
    //
    // Doğrulanmış terim uyumu taşımayan değişiklik de önerilmiyor: madde
    // yazımının tek amacı terim uyumu. Uyumsuz bir değişiklik ya sessiz bir
    // çeviri ya da eş anlamlı kelime oyunudur (K-38, K-39).
    if (verification.status !== "ok" || verified.length === 0) {
      input.onDiscard?.({
        id: bulletItem.id,
        reason: verification.status !== "ok" ? "flagged" : "unaligned",
        detail:
          verification.status !== "ok"
            ? verification.issues.map((u) => `${u.kind}: ${u.detail}`).join(" | ")
            : `doğrulanan uyum yok (iddia: ${bulletClaims.map((a) => `${a.term} ← ${a.basis}`).join("; ") || "yok"})`,
        rewritten: fresh,
      })
      return { ...bulletItem, rewritten: bulletItem.original, verification: CLEAN, alignments: [], decision: "accepted" }
    }

    return {
      ...bulletItem,
      rewritten: fresh,
      verification,
      alignments: verified.map(({ term, basis }) => ({ term, basis })),
      // Terim uyumu taşıyan madde onay bekliyor: dayanak kodda doğrulanıyor
      // ama "bu terim deneyimini doğru anlatıyor mu" sorusunu gömme
      // benzerliği yanıtlayamıyor, yanıtı adayın kendisi biliyor (K-38).
      decision: "pending",
    }
  })

  // Özet CV'nin tamamına karşı doğrulanıyor: maddelerde geçen bir teknolojiyi
  // özette öne çıkarmak uydurma değil. Uyarı taşıyorsa reddediliyor; özet
  // indirmeyi bloklamıyor, kullanıcının görmediği metni çıktıya koymaktansa
  // orijinal korunuyor.
  //
  // Özgün özetteki sayıları (deneyim yılı), ilan kavramlarını ve özette
  // adı geçen becerileri kaybeden yazım da gösterilmiyor; özet olduğu gibi
  // kalıyor.
  const summaryPreservation =
    profile.summary && summaryText
      ? preservesSource({
          rewritten: summaryText.data,
          source: profile.summary,
          posting,
          // Özgün özetin andığı beceriler de kalmalı; yoksa model özeti
          // genelleştirip güçlü terimleri atabiliyor.
          bases: summaryAnchors(profile.summary, profile.skills),
        })
      : null
  const summaryPreserved = !!summaryPreservation?.ok
  if (summaryText && summaryPreservation && !summaryPreservation.ok) {
    input.onDiscard?.({ id: "summary", reason: "not_preserved", detail: summaryPreservation.reason, rewritten: summaryText.data })
  }
  const summaryRewrite = summaryPreserved ? summaryText!.data : (profile.summary ?? "")
  const summaryVerification =
    profile.summary && summaryPreserved
      ? verifyRewrite({ rewritten: summaryRewrite, source: fullResumeText, posting })
      : CLEAN
  if (summaryVerification.status !== "ok") {
    input.onDiscard?.({
      id: "summary",
      reason: "flagged",
      detail: summaryVerification.issues.map((u) => `${u.kind}: ${u.detail}`).join(" | "),
      rewritten: summaryRewrite,
    })
  }

  const addedSkillList = skillsFromBullets(profile, posting)
  const draft = AdaptationDraftSchema.parse({
    summary: {
      original: profile.summary,
      rewritten: profile.summary ? summaryRewrite : "",
      verification: summaryVerification,
      decision: summaryVerification.status === "ok" ? "accepted" : "rejected",
    },
    bullets,
    // Eklenenler başta: ilanın doğrudan istediği terimler ve ATS'ler listenin
    // başını daha çok tartıyor.
    skillOrder: [...addedSkillList, ...orderSkillsForPosting(profile.skills, result)],
    addedSkills: addedSkillList,
  })

  // Özet yazımı skoru düşürüyorsa özgün özet kalıyor (kullanıcı kararı).
  const guarded = await guardSummaryScore({ profile, posting, draft }, embedding)
  if (guarded.dropped) {
    input.onDiscard?.({
      id: "summary",
      reason: "score_drop",
      detail: `skor ${guarded.dropped.withOriginal} → ${guarded.dropped.withRewrite}`,
      rewritten: draft.summary.rewritten,
    })
  }

  const tokens =
    rewrites.reduce((totalSum, y) => totalSum + (y?.tokens ?? 0), 0) + (summaryText?.tokens ?? 0)
  return { draft: guarded.draft, tokens }
}
