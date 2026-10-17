import type { CoverLetterRecord } from "@uyarla/core"

/** `GET /api/adapt/[id]` yanıtının arayüzün kullandığı kısmı. */

export interface Verification {
  status: "ok" | "flagged"
  issues: Array<{ kind: string; detail: string }>
}

export interface Bullet {
  id: string
  original: string
  rewritten: string
  verification: Verification
  /** İlanın terimine çevrilen ifade ve dayanağı; eski taslaklarda yok. */
  alignments?: Array<{ term: string; basis: string }>
  decision: "accepted" | "rejected" | "pending"
}

/** Kullanıcının anlattığı deneyimden yazılan madde (DOG-94). */
export interface Contribution {
  id: string
  requirementIndex: number
  experienceIndex: number
  answer: string
  status: "running" | "done" | "failed"
  text?: string
  verification?: Verification
  alignments?: Array<{ term: string; basis: string }>
  decision: "accepted" | "rejected" | "pending"
}

export interface Draft {
  summary: {
    original: string | null
    rewritten: string
    verification: Verification
    decision: string
  }
  bullets: Bullet[]
  skillOrder: string[]
  /** CV'nin maddelerinden beceri listesine eklenenler; eski taslaklarda yok. */
  addedSkills?: string[]
  /** Kullanıcı katkıları (DOG-94); eski taslaklarda yok. */
  contributions?: Contribution[]
}

/** Belge görünümünün bir hâli; sunucudaki DocumentOutline ile aynı (DOG-93). */
export interface DocumentOutline {
  headline: string | null
  summary: string | null
  experience: Array<{ company: string; title: string; startDate: string; endDate: string; bullets: string[] }>
  skills: string[]
}

export interface AdaptationState {
  status: "running" | "draft" | "ready" | "failed"
  /** API şimdilik göndermiyor; gelirse çizelge onu izler. */
  stage?: string | null
  draft: Draft | null
  scoreBefore: number | null
  scoreAfter: number | null
  coverLetter: CoverLetterRecord | null
  /** Önceki ve indirilecek hâl; profil yoksa ya da taslak hazır değilse null. */
  document?: { before: DocumentOutline; after: DocumentOutline } | null
  /** Analizde karşılanmayan zorunlu gereksinimler; "AI ile yaz" bunlar için (DOG-94). */
  missingRequirements?: Array<{ index: number; text: string }>
}
