import { prisma } from "@uyarla/db"
import type { AdaptedSummary } from "@uyarla/core/score/adapted"

/**
 * Uyarlanmış CV'nin özetini analiz sonucuna yazar (DOG-166); pano, başvuru
 * ayrıntısı ve mülakat paketi bunu okuyor. Yalnızca `adapted` anahtarı
 * değişiyor (jsonb_set): "ilanda yok" işaretleri aynı JSON'a yazılıyor,
 * okuyup bütün sonucu geri yazmak onları ezebilirdi. Değişmediyse yazılmıyor;
 * uyarlama sayfası her açılışta hesaplıyor. Yazdıysa true.
 */
export async function rememberAdapted(analysisId: string, result: unknown, summary: AdaptedSummary): Promise<boolean> {
  const previous = (result as { adapted?: unknown } | null)?.adapted
  if (previous && JSON.stringify(previous) === JSON.stringify(summary)) return false
  await prisma.$executeRaw`UPDATE "Analysis" SET result = jsonb_set(COALESCE(result, '{}'::jsonb), '{adapted}', ${JSON.stringify(summary)}::jsonb) WHERE id = ${analysisId}`
  return true
}
