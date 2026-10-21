/**
 * Sonuç sayfasının yapışkan özeti (DOG-131). Kategoriler bizim skor
 * yapımızdan; sayılar mevcut sonuç verisinden, yeni hesap yok. Her satır
 * sayfadaki bölümüne kaydırıyor.
 */
export type ResultSectionId = "skor" | "bicim" | "sartlar" | "gereksinimler" | "kavramlar"

export interface ResultNavItem {
  key: "must" | "nice" | "title" | "format" | "conditions" | "keywords"
  label: string
  /** Kaydırılacak bölüm. */
  target: ResultSectionId
  /** Düzeltilecek ya da kontrol edilecek sayısı; 0 ise tamam. */
  issues: number
  /** Varsa ilerleme çubuğu: karşılanan / toplam. */
  progress?: { done: number; total: number }
  /** Gereksinim listesini "Eksikler" süzgecine alır. */
  filterMissing?: boolean
}

interface NavInput {
  requirements: Array<{ requirement: { importance: string }; status: string }>
  titleMissing: boolean | null
  formatFindings: number | null
  conditionsToCheck: number
  missingKeywords: number
}

export function resultNav(input: NavInput): ResultNavItem[] {
  const must = input.requirements.filter((r) => r.requirement.importance === "must")
  const nice = input.requirements.filter((r) => r.requirement.importance !== "must")
  const met = (list: typeof must) => list.filter((r) => r.status === "matched").length
  const items: ResultNavItem[] = []
  if (must.length > 0) {
    items.push({
      key: "must",
      label: "Zorunlu gereksinimler",
      target: "gereksinimler",
      issues: must.length - met(must),
      progress: { done: met(must), total: must.length },
      filterMissing: true,
    })
  }
  if (nice.length > 0) {
    items.push({
      key: "nice",
      label: "Tercih edilenler",
      target: "gereksinimler",
      issues: nice.length - met(nice),
      progress: { done: met(nice), total: nice.length },
      filterMissing: true,
    })
  }
  if (input.titleMissing !== null) items.push({ key: "title", label: "Unvan", target: "skor", issues: input.titleMissing ? 1 : 0 })
  if (input.formatFindings !== null) items.push({ key: "format", label: "Biçim", target: "bicim", issues: input.formatFindings })
  if (input.conditionsToCheck > 0) items.push({ key: "conditions", label: "Şartlar", target: "sartlar", issues: input.conditionsToCheck })
  items.push({ key: "keywords", label: "Görünmeyen kavramlar", target: "kavramlar", issues: input.missingKeywords })
  return items
}

/** Satırın kısa durumu: "3 eksik", "kontrol et", "tamam". */
export function navStatus(item: ResultNavItem): string {
  if (item.issues === 0) return "tamam"
  if (item.key === "conditions") return `${item.issues} kontrol et`
  if (item.key === "format") return `${item.issues} öneri`
  if (item.key === "title") return "geçmiyor"
  return `${item.issues} eksik`
}
