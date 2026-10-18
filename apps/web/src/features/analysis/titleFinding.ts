import type { FormatFinding } from "@uyarla/core/format/check"
import type { TitleMatch } from "@uyarla/core/score/title"
import type { FormatReportView } from "@/features/analysis/components/FormatReport"

/**
 * Unvan eşleşmesini (DOG-87) CV kontrolündeki "İşe alımcı gözüyle"
 * bölümüne bulgu olarak ekler. Biçim raporu CV'ye bağlı ve analizden önce
 * hesaplanıyor; unvan ise ilana bağlı. İkisi ekranda birleşiyor, kayıtta ayrı
 * duruyor.
 *
 * Eski analizlerde titleMatch yok; rapor olduğu gibi kalıyor. Biçim raporu
 * yoksa (kontrol patladı) unvan tek başına bir kart açmıyor.
 */
export function withTitleFinding(
  format: FormatReportView | null | undefined,
  match: TitleMatch | null | undefined,
): FormatReportView | null {
  if (!format) return null
  if (!match) return format

  if (match.level === "exact") return { ...format, passed: [...format.passed, "İlandaki unvan"] }

  const finding: FormatFinding =
    match.level === "partial"
      ? {
          code: "title_partial",
          severity: "warning",
          group: "content",
          title: `Unvan yakın ama aynı değil: ilanda “${match.position}”`,
          description: `CV'nde “${match.resumeTitle}” yazıyor. İşe alımcılar ATS'de çoğu zaman unvanla arıyor; deneyimin gerçekten bu role uyuyorsa başlık satırına ilandaki unvanı yazmak aramada görünmeni kolaylaştırır.`,
        }
      : {
          code: "title_missing",
          severity: "warning",
          group: "content",
          title: `İlandaki unvan CV'nde geçmiyor: “${match.position}”`,
          description:
            "İşe alımcılar ATS'de çoğu zaman unvanla arıyor. Deneyimin bu role uyuyorsa adının altındaki başlık satırına ilandaki unvanı yaz; uymuyorsa bu bir eksik değil, başvurduğun rolün farklı olduğunu gösteriyor.",
        }
  return { ...format, findings: [...format.findings, finding] }
}
