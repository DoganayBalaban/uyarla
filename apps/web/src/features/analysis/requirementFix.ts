import type { ExclusionMark, ExclusionReason } from "@uyarla/core/score/exclusions"

/**
 * Gereksinim satırındaki düzeltmelerin metinleri ve kuralları (DOG-90).
 * Bileşenden ayrı: davranışı testle sabitlemek için.
 */

export const REASON_OPTIONS: { value: ExclusionReason; label: string; hint: string; canRemember: boolean }[] = [
  {
    value: "not_in_posting",
    label: "İlanda böyle bir şart yok",
    hint: "İlanı yanlış okumuşuz; skora katılmasın.",
    canRemember: true,
  },
  {
    value: "irrelevant",
    label: "Bu iş için ilgisiz",
    hint: "İlanda geçiyor ama bu rol için önemsiz; skora katılmasın.",
    canRemember: true,
  },
  {
    value: "found_in_cv",
    label: "CV'mde var ama bulunamamış",
    // Hariç tutmuyor: kanıtı göremediğimiz bir şeyi skordan silmek dürüst olmaz.
    hint: "Skoru değiştirmez; bize hata olarak bildirilir.",
    canRemember: false,
  },
]

export function exclusionLabel(mark: ExclusionMark | undefined): string {
  if (!mark) return "İlanda yok olarak işaretlendi"
  if (mark.scope === "profile") return "Hariç tuttuğun kavramlar listende"
  const base = mark.reason === "irrelevant" ? "İlgisiz olarak işaretlendi" : "İlanda yok olarak işaretlendi"
  return mark.scope === "always" ? `${base} · listende` : base
}

/** Düzeltilebilen şart: deneyimde istenen yıl, eğitimde kabul edilen terimler. */
export function correctionKind(type: string): "years" | "terms" | null {
  if (type === "experience") return "years"
  if (type === "education") return "terms"
  return null
}

/** "Bilgisayar Mühendisliği, ilgili bölümler" → terimler. */
export function parseTerms(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

export type RequirementMenuKey = "show" | "mark" | "correct"

/**
 * Gereksinim satırının işlemleri (DOG-146). Eksik yıl ve bölüm şartının
 * düzeltmesi satırda görünür kalıyor (DOG-134: en sık düzeltilen şey);
 * gerisi satırın menüsünde.
 */
export function requirementMenu(input: {
  canChange: boolean
  canShowInPosting: boolean
  kind: "years" | "terms" | null
  /** Düzeltme satırda görünüyor mu (eksik yıl ya da bölüm şartı). */
  inlineFix: boolean
  corrected: boolean
}): { inline: string | null; menu: Array<{ key: RequirementMenuKey; label: string }> } {
  const { canChange, canShowInPosting, kind, inlineFix, corrected } = input
  const inline =
    canChange && kind && inlineFix && !corrected
      ? kind === "years"
        ? "Yıl yanlış mı okunmuş? Düzelt"
        : "Bölüm yanlış mı okunmuş? Düzelt"
      : null
  const menu: Array<{ key: RequirementMenuKey; label: string }> = []
  if (canShowInPosting) menu.push({ key: "show", label: "İlanda göster" })
  if (canChange && kind && !inline) menu.push({ key: "correct", label: corrected ? "Düzeltmeyi değiştir" : "Şartı düzelt" })
  if (canChange) menu.push({ key: "mark", label: "Bu şartta sorun var" })
  return { inline, menu }
}
