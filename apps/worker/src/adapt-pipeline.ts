import {
  PermanentError,
  TransientError,
  buildAdaptationDraft,
  hasPendingDecisions,
} from "@uyarla/core"
import type { AdaptPipelineDeps } from "./adapt-types.js"

/**
 * adapt işinin aşama sırası (spec §4):
 * hedef seçimi → yeniden yazma → doğrulama → taslak kaydı.
 *
 * Yeni bir çıkarım yok: profil ve ilan Sprint 1'de zaten çıkarılmış. Taslağın
 * kendisi core'da üretiliyor (buildAdaptationDraft); değerlendirme betiği de
 * aynı fonksiyonu çağırıyor ki ölçülen ile çalışan aynı olsun.
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

    const { draft, tokens } = await buildAdaptationDraft({
      llm: deps.llm,
      embedding: deps.embedding,
      profile,
      posting,
      result,
      onStage: (stage) => deps.onProgress?.(stage),
    })

    await deps.store.saveDraft({
      adaptationId: input.adaptationId,
      draft,
      status: hasPendingDecisions(draft) ? "draft" : "ready",
      durationMs: now() - basladi,
      tokenUsage: tokens,
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
