import { STAGES, type BoardCard, type Stage } from "@/features/applications/board"

/**
 * Başvuru tablosunun süzme ve sıralaması (DOG-148). Bileşenden ayrı:
 * davranışı testle sabitlemek için.
 */

export type SortKey = "position" | "score" | "stage" | "deadline" | "interviewAt" | "updated"
export type SortDir = "asc" | "desc"

/** Kartın son değiştiği an: aşama değişikliği, yoksa analiz. */
export const updatedAt = (c: BoardCard) => c.stageChangedAt ?? c.createdAt

/** Pozisyon ya da şirkette geçen, seçilen aşamadaki kartlar. Arama Türkçe küçük harfle. */
export function filterCards(cards: BoardCard[], { query = "", stage = "all" }: { query?: string; stage?: Stage | "all" }): BoardCard[] {
  const q = query.trim().toLocaleLowerCase("tr-TR")
  return cards.filter(
    (c) =>
      (stage === "all" || c.stage === stage) &&
      (!q || `${c.position} ${c.company ?? ""}`.toLocaleLowerCase("tr-TR").includes(q)),
  )
}

/** Boş değerler (skorsuz, tarihsiz) yönden bağımsız olarak sonda. */
export function sortCards(cards: BoardCard[], key: SortKey, dir: SortDir): BoardCard[] {
  const value = (c: BoardCard): string | number | null => {
    switch (key) {
      case "position":
        return c.position.toLocaleLowerCase("tr-TR")
      case "score":
        return c.score
      case "stage":
        return STAGES.indexOf(c.stage)
      case "deadline":
        return c.deadline
      case "interviewAt":
        return c.interviewAt
      case "updated":
        return updatedAt(c)
    }
  }
  const sign = dir === "asc" ? 1 : -1
  return [...cards].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign
    return String(x).localeCompare(String(y), "tr-TR") * sign
  })
}
