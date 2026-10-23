import type { AuditSectionId, AuditSectionStatus, LinkedInAuditReport } from "@uyarla/core/linkedin/audit"
import type { AuditResponse } from "@/features/linkedin/audit"

/** LinkedIn denetiminin bölüm ve durum adları (DOG-157). */
export const SECTION_LABELS: Record<AuditSectionId, string> = {
  headline: "Başlık",
  about: "Hakkında",
  experience: "Deneyim",
  education: "Eğitim",
  certifications: "Sertifikalar",
  skills: "Beceriler",
  postings: "İlanlarına göre",
}

export const STATUS_LABELS: Record<AuditSectionStatus, string> = {
  strong: "Güçlü",
  improve: "Geliştirilebilir",
  missing: "Eksik",
  info: "Bilgi",
}

const RANK: Record<AuditSectionStatus, number> = { missing: 0, improve: 1, strong: 2, info: 2 }

/** Önceki taramaya göre: geçen kontrol farkı ve durumu iyileşen bölümler. */
export function sectionDelta(
  previous: AuditResponse["previous"],
  report: Pick<LinkedInAuditReport, "summary" | "sections">,
): { passedDelta: number; improved: AuditSectionId[] } | null {
  if (!previous) return null
  const before = new Map(previous.sections.map((s) => [s.id, s.status]))
  return {
    passedDelta: report.summary.passed - previous.summary.passed,
    improved: report.sections.filter((s) => before.has(s.id) && RANK[s.status] > RANK[before.get(s.id)!]).map((s) => s.id),
  }
}

export function initials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase("tr"))
    .join("")
}
