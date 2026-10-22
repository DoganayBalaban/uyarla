import { daysUntil, type BoardCard } from "@/features/applications/board"

/**
 * Mülakatlar merkezi (DOG-152): mülakat aşamasındakiler tarihe göre;
 * tarihsizler ayrı; teklif, ret ve günü geçen mülakatlar geçmişte.
 */
export interface InterviewGroups {
  upcoming: Array<{ card: BoardCard; days: number }>
  undated: BoardCard[]
  past: BoardCard[]
}

export function interviewGroups(cards: BoardCard[], now: Date = new Date()): InterviewGroups {
  const upcoming: InterviewGroups["upcoming"] = []
  const undated: BoardCard[] = []
  const past: BoardCard[] = []
  for (const card of cards) {
    if (card.stage === "interview") {
      if (!card.interviewAt) undated.push(card)
      else {
        const days = daysUntil(card.interviewAt, now)
        if (days >= 0) upcoming.push({ card, days })
        else past.push(card)
      }
    } else if ((card.stage === "offer" || card.stage === "rejected") && card.interviewAt) {
      past.push(card)
    } else if (card.stage === "offer") {
      past.push(card)
    }
  }
  upcoming.sort((a, b) => a.days - b.days)
  // Geçmiş: en yeni önde; tarihsiz teklif aşamaya geçtiği günle.
  const pastDay = (c: BoardCard) => c.interviewAt ?? (c.stageChangedAt ?? c.createdAt).slice(0, 10)
  past.sort((a, b) => pastDay(b).localeCompare(pastDay(a)))
  return { upcoming, undated, past }
}

/** "Bugün", "Yarın", "3 gün kaldı". */
export function daysLabel(days: number): string {
  if (days === 0) return "Bugün"
  if (days === 1) return "Yarın"
  return `${days} gün kaldı`
}
