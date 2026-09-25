import {
  AdaptationDraftSchema,
  PermanentError,
  TransientError,
  bulletId,
  hasPendingDecisions,
  orderSkillsForPosting,
  rewriteBullets,
  rewriteSummary,
  verifyRewrite,
  type AdaptationDraft,
  type AdaptedBullet,
} from "@uyarla/core"
import type { AdaptPipelineDeps } from "./adapt-types.js"

/**
 * adapt işinin aşama sırası (spec §4):
 * yeniden yazma → doğrulama → taslak kaydı.
 *
 * Yeni bir çıkarım yok: profil ve ilan Sprint 1'de zaten çıkarılmış. Bu
 * hattın tek LLM işi yeniden ifade, ve o da madde başına ayrı çağrıyla.
 */
export async function runAdaptation(
  deps: AdaptPipelineDeps,
  input: { adaptationId: string },
): Promise<void> {
  const now = deps.now ?? Date.now
  const basladi = now()

  try {
    const { profile, posting, result } = await deps.store.getAdaptationContext(
      input.adaptationId,
    )

    deps.onProgress?.("yeniden_yaziliyor")

    // Maddeler düzleştiriliyor: kimlik konumdan türüyor ve taslak profile
    // bu kimlikle geri bağlanıyor (bkz. applyAdaptation).
    const maddeler = profile.experience.flatMap((job, i) =>
      job.bullets.map((bullet, j) => ({
        id: bulletId(i, j),
        experienceIndex: i,
        original: bullet.text,
        sourceRef: bullet.sourceRef,
      })),
    )

    const [yazimlar, ozet] = await Promise.all([
      rewriteBullets(
        deps.llm,
        maddeler.map((m) => m.original),
        posting,
      ),
      profile.summary
        ? rewriteSummary(deps.llm, { summary: profile.summary, posting })
        : Promise.resolve(null),
    ])

    deps.onProgress?.("kontrol_ediliyor")

    // Anlamsal sapma için tek toplu gömme çağrısı: önce yeniden yazımlar,
    // sonra kaynaklar. Sıralama aşağıdaki dilimlemeyle eşleşmek zorunda.
    const yeniMetinler = maddeler.map((m, i) => yazimlar[i]?.data ?? m.original)
    const kaynakMetinler = maddeler.map((m) => m.sourceRef)
    const vektorler = await deps.embedding.embed([...yeniMetinler, ...kaynakMetinler])

    const bullets: AdaptedBullet[] = maddeler.map((madde, i) => {
      const yeni = yeniMetinler[i]!
      // Yeniden yazım patladıysa madde orijinal hâliyle kalıyor ve
      // doğrulamaya sokulmuyor: kendi cümlesini uyarmak anlamsız (spec §13).
      const basarisiz = yazimlar[i] === null
      const verification = basarisiz
        ? { status: "ok" as const, issues: [] }
        : verifyRewrite({
            rewritten: yeni,
            source: madde.sourceRef,
            posting,
            vectors: {
              rewritten: vektorler[i]!,
              source: vektorler[maddeler.length + i]!,
            },
          })

      return {
        ...madde,
        rewritten: yeni,
        verification,
        // K-26: risk tabanlı onay. Doğrulamayı geçen madde varsayılan olarak
        // kabul, uyarı taşıyan madde karar bekliyor.
        decision: verification.status === "ok" ? "accepted" : "pending",
      }
    })

    // Özet uyarı taşıyorsa reddediliyor: özet tek parça ve indirmeyi
    // bloklamıyor, o yüzden kullanıcının görmediği bir metni çıktıya
    // koymaktansa orijinali korunuyor.
    const ozetYazimi = ozet?.data ?? profile.summary ?? ""
    const ozetDogrulama =
      profile.summary && ozet
        ? verifyRewrite({ rewritten: ozetYazimi, source: profile.summary, posting })
        : { status: "ok" as const, issues: [] }

    const draft: AdaptationDraft = AdaptationDraftSchema.parse({
      summary: {
        original: profile.summary,
        rewritten: profile.summary ? ozetYazimi : "",
        verification: ozetDogrulama,
        decision: ozetDogrulama.status === "ok" ? "accepted" : "rejected",
      },
      bullets,
      skillOrder: orderSkillsForPosting(profile.skills, result),
    })

    await deps.store.saveDraft({
      adaptationId: input.adaptationId,
      draft,
      status: hasPendingDecisions(draft) ? "draft" : "ready",
      durationMs: now() - basladi,
      tokenUsage:
        yazimlar.reduce((toplam, y) => toplam + (y?.tokens ?? 0), 0) + (ozet?.tokens ?? 0),
    })

    deps.onProgress?.("tamamlandi")
  } catch (error) {
    // Başarısız uyarlamalar da kayda yazıyor (spec §13): hangi adımda ne
    // patlıyor bilgisi olmadan teşhis imkânsız.
    try {
      await deps.store.failAdaptation(input.adaptationId, siniflandir(error))
    } catch {
      // Kayıt da düşerse asıl hata gizlenmemeli.
    }
    throw error
  }
}

function siniflandir(error: unknown): string {
  if (error instanceof PermanentError || error instanceof TransientError) return error.code
  return "unknown"
}
