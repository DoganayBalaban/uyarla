/**
 * LinkedIn profil raporu kaydı (DOG-69). Tarayıcı da okuyor; hesaplama
 * `report.ts`'de ve skorlama koduna bağlı.
 */
export const MAX_REPORT_POSTINGS = 3

export type LinkedInCheckId = "headline_empty" | "headline_target" | "headline_generic" | "about_missing" | "about_short" | "skills_few"

export interface LinkedInCheck {
  id: LinkedInCheckId
  status: "ok" | "warn"
  text: string
}

export interface LinkedInReport {
  postings: Array<{ analysisId: string; position: string; company: string | null; score: number }>
  /** Seçilen ilanların en az ikisinde (tek ilanda: o ilanda) eksik kalan kavramlar. */
  commonMissing: Array<{ term: string; postings: number; must: boolean }>
  checks: LinkedInCheck[]
  /** Profilin başlığı ve "Hakkında" metni, PDF'ten okunduğu gibi. */
  headline: string | null
  about: string | null
}

export type LinkedInReportRecord =
  | { status: "running"; analysisIds: string[]; createdAt: string }
  | { status: "failed"; analysisIds: string[]; createdAt: string }
  | { status: "done"; analysisIds: string[]; createdAt: string; report: LinkedInReport }
