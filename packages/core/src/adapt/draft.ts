import { cosineSimilarity } from "../llm/embedding.js"
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
import { preservesSource } from "../verify/preserve.js"
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
  onStage?: (stage: "yeniden_yaziliyor" | "kontrol_ediliyor") => void
  targetOptions?: TargetOptions
  alignmentConfig?: AlignmentConfig
}

const TEMIZ: Verification = { status: "ok", issues: [] }

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
  const hizalamaCfg = input.alignmentConfig ?? DEFAULT_ALIGNMENT_CONFIG

  const maddeler = profile.experience.flatMap((job, i) =>
    job.bullets.map((bullet, j) => ({
      id: bulletId(i, j),
      experienceIndex: i,
      original: bullet.text,
      sourceRef: bullet.sourceRef,
    })),
  )

  // 1. Hedefler: her maddeye anlamca yakın, henüz karşılanmamış ilan terimleri.
  const kavramMetinleri = conceptTexts(posting)
  const hedefVektorleri = await embedding.embed([
    ...maddeler.map((m) => m.original),
    ...kavramMetinleri,
  ])
  const hedefler = alignmentTargets(
    {
      bullets: maddeler.map((m) => m.original),
      bulletVectors: hedefVektorleri.slice(0, maddeler.length),
      posting,
      conceptVectors: hedefVektorleri.slice(maddeler.length),
      result,
    },
    input.targetOptions ?? DEFAULT_TARGET_OPTIONS,
  )

  // 2. Yazım.
  input.onStage?.("yeniden_yaziliyor")
  const cvMetni = resumeText(profile)
  const [yazimlar, ozet] = await Promise.all([
    rewriteBullets(
      llm,
      maddeler.map((m, i) => ({
        bullet: m.original,
        targets: hedefler[i]!.map((h) => h.label),
      })),
    ),
    profile.summary
      ? rewriteSummary(llm, {
          summary: profile.summary,
          posting,
          supportedTerms: supportedConceptTerms(posting, cvMetni),
        })
      : Promise.resolve(null),
  ])

  // 3. Doğrulama. Tek toplu gömme: yazımlar, kaynaklar, sonra her uyumun
  // terimi ve dayanağı. Sıra aşağıdaki dilimlemeyle eşleşmek zorunda.
  input.onStage?.("kontrol_ediliyor")
  const yeniMetinler = maddeler.map((m, i) => yazimlar[i]?.data.text ?? m.original)
  const iddialar = maddeler.flatMap((_, i) =>
    (yazimlar[i]?.data.alignments ?? []).map((a) => ({ madde: i, ...a })),
  )
  const vektorler = await embedding.embed([
    ...yeniMetinler,
    ...maddeler.map((m) => m.sourceRef),
    ...iddialar.map((a) => a.term),
    ...iddialar.map((a) => a.basis),
  ])
  const n = maddeler.length
  const k = iddialar.length
  const benzerlik = (j: number) => {
    const a = vektorler[2 * n + j]
    const b = vektorler[2 * n + k + j]
    return a && b ? cosineSimilarity(a, b) : 0
  }

  const bullets: AdaptedBullet[] = maddeler.map((madde, i) => {
    const yeni = yeniMetinler[i]!
    // Yazılmayan (hedefsiz ya da patlayan) madde doğrulamaya sokulmuyor:
    // kullanıcının kendi cümlesini uyarmak anlamsız (spec §13).
    if (!yazimlar[i] || yeni === madde.original) {
      return { ...madde, rewritten: madde.original, verification: TEMIZ, alignments: [], decision: "accepted" }
    }

    const maddeIddialari = iddialar
      .map((a, j) => ({ ...a, j }))
      .filter((a) => a.madde === i)
    const dogrulanan = verifyAlignments(
      {
        alignments: maddeIddialari.map(({ term, basis }) => ({ term, basis })),
        source: madde.sourceRef,
        targets: hedefler[i]!.map((h) => h.concept),
        similarities: maddeIddialari.map((a) => benzerlik(a.j)),
      },
      hizalamaCfg,
    )

    // Bilgi kaybeden yazım gösterilmiyor bile: madde olduğu gibi kalıyor.
    // Kullanıcıya bozuk bir cümle gösterip reddettirmek yerine hiç önermemek
    // daha dürüst ve daha az yorucu (verify/preserve.ts).
    const korunuyor = preservesSource({
      rewritten: yeni,
      source: madde.sourceRef,
      posting,
      bases: dogrulanan.map((d) => d.basis),
    })
    if (!korunuyor.ok) {
      return { ...madde, rewritten: madde.original, verification: TEMIZ, alignments: [], decision: "accepted" }
    }

    const verification = verifyRewrite({
      rewritten: yeni,
      source: madde.sourceRef,
      posting,
      vectors: { rewritten: vektorler[i]!, source: vektorler[n + i]! },
      allowedTerms: dogrulanan.map((d) => d.concept.term),
    })

    // Uydurma, sayı ya da sapma uyarısı alan yazım da önerilmiyor. K-26'da
    // uyarılı madde kullanıcıya gösterilip karara bırakılıyordu; ama artık
    // yalnızca hedefi olan maddeler yazılıyor ve uyarılı bir yazım başarısız
    // bir denemedir. Uçtan uca testte bu, "…bütçeyi optimize ederek Bütçe
    // yönetimi gerçekleştirdim" gibi reddedilmesi kesin cümleleri kullanıcının
    // önüne koyuyordu (K-38).
    if (verification.status !== "ok") {
      return { ...madde, rewritten: madde.original, verification: TEMIZ, alignments: [], decision: "accepted" }
    }

    return {
      ...madde,
      rewritten: yeni,
      verification,
      alignments: dogrulanan.map(({ term, basis }) => ({ term, basis })),
      // Terim uyumu taşıyan madde onay bekliyor: dayanak kodda doğrulanıyor
      // ama "bu terim deneyimini doğru anlatıyor mu" sorusunu gömme
      // benzerliği yanıtlayamıyor, yanıtı adayın kendisi biliyor (K-38).
      decision: dogrulanan.length === 0 ? "accepted" : "pending",
    }
  })

  // Özet CV'nin tamamına karşı doğrulanıyor: maddelerde geçen bir teknolojiyi
  // özette öne çıkarmak uydurma değil. Uyarı taşıyorsa reddediliyor; özet
  // indirmeyi bloklamıyor, kullanıcının görmediği metni çıktıya koymaktansa
  // orijinal korunuyor.
  //
  // Özgün özetteki sayıları (deneyim yılı) ve ilan kavramlarını kaybeden
  // yazım da gösterilmiyor; özet olduğu gibi kalıyor.
  const ozetKorunuyor =
    !!profile.summary &&
    !!ozet &&
    preservesSource({ rewritten: ozet.data, source: profile.summary, posting }).ok
  const ozetYazimi = ozetKorunuyor ? ozet!.data : (profile.summary ?? "")
  const ozetDogrulama =
    profile.summary && ozetKorunuyor
      ? verifyRewrite({ rewritten: ozetYazimi, source: cvMetni, posting })
      : TEMIZ

  const eklenenBeceriler = skillsFromBullets(profile, posting)
  const draft = AdaptationDraftSchema.parse({
    summary: {
      original: profile.summary,
      rewritten: profile.summary ? ozetYazimi : "",
      verification: ozetDogrulama,
      decision: ozetDogrulama.status === "ok" ? "accepted" : "rejected",
    },
    bullets,
    // Eklenenler başta: ilanın doğrudan istediği terimler ve ATS'ler listenin
    // başını daha çok tartıyor.
    skillOrder: [...eklenenBeceriler, ...orderSkillsForPosting(profile.skills, result)],
    addedSkills: eklenenBeceriler,
  })

  const tokens =
    yazimlar.reduce((toplam, y) => toplam + (y?.tokens ?? 0), 0) + (ozet?.tokens ?? 0)
  return { draft, tokens }
}
