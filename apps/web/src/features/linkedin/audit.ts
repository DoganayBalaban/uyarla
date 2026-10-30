import { z } from "zod"
import { resumeFileSchema } from "@/features/analysis/schema"
import { LinkedInProfileDataSchema, type LinkedInProfileData } from "@uyarla/core/linkedin/profileData"
import type { AuditSectionId, AuditSectionStatus, LinkedInAuditReport } from "@uyarla/core/linkedin/audit"
import type { LinkedInRewrites } from "@uyarla/core/linkedin/rewrite"

/**
 * LinkedIn profil denetiminin istemciyle sunucu arasındaki sözleşmesi
 * (DOG-157, spec §6). İstemci-güvenli: core'un yalnızca saf alt yolları.
 */
export const MAX_AUDIT_POSTINGS = 3
export const MAX_AUDIT_BODY_BYTES = 64 * 1024
export const MAX_RETRIES = 3
export const STUCK_MS = 10 * 60_000
export const KEEP_AUDITS = 5

const common = {
  targetRole: z.string().trim().max(120).nullable(),
  analysisIds: z.array(z.string().min(1)).max(MAX_AUDIT_POSTINGS),
}
export const auditRequestSchema = z.discriminatedUnion("source", [
  z.object({ source: z.literal("extension"), profile: LinkedInProfileDataSchema, ...common }),
  z.object({ source: z.literal("pdf"), resumeId: z.string().min(1), ...common }),
])
export type AuditRequest = z.input<typeof auditRequestSchema>

/**
 * LinkedIn PDF'i doğrudan denetim sayfasından (DOG-166). Önce CV'lerim'e
 * yüklemek gerekiyordu: profil "CV" diye kaydediliyor, ilk dosyaysa "Temel
 * CV" oluyor ve yeni analizde CV yerine seçili geliyordu. Yüklenen PDF
 * kütüphaneye girmiyor. LinkedIn profili yalnızca PDF olarak indiriyor.
 */
const auditUploadSchema = z.object({
  // Dosya yoksa ya da bozuksa üstteki kural zaten hata veriyor.
  file: resumeFileSchema.refine((f) => typeof f?.name !== "string" || f.name.toLowerCase().endsWith(".pdf"), "LinkedIn'den indirdiğin PDF'i seçer misin?"),
  ...common,
})

export function parseAuditUpload(form: FormData) {
  const role = form.get("targetRole")
  let analysisIds: unknown = []
  try {
    const raw = form.get("analysisIds")
    if (typeof raw === "string" && raw) analysisIds = JSON.parse(raw)
  } catch {
    analysisIds = null
  }
  return auditUploadSchema.safeParse({
    file: form.get("file") ?? undefined,
    targetRole: typeof role === "string" && role.trim() ? role : null,
    analysisIds,
  })
}

/** Worker kayda son dokunuşundan (updatedAt) bu yana 10 dakika geçtiyse tarama takılmış. */
export function isStuck(since: Date, now: Date): boolean {
  return now.getTime() - since.getTime() >= STUCK_MS
}

/**
 * Ekranın gördüğü durum (son inceleme): takılan tarama (worker çöktü, iş
 * kayboldu, web ile worker dağıtımı arası) bekleme ekranında sonsuza dek
 * kalmasın. İlk taramada "failed" (başlangıç paneli), yeniden denemede bitmiş
 * sonuç geri geliyor; yoklama da duruyor.
 */
export function presentedStatus(
  audit: { status: "running" | "done" | "failed"; updatedAt: Date; report: unknown; rewrites: unknown },
  now: Date,
): "running" | "done" | "failed" {
  if (audit.status !== "running" || !isStuck(audit.updatedAt, now)) return audit.status
  return audit.report && audit.rewrites ? "done" : "failed"
}

/** Kilitli parçalar yanıttan çıkmış yazımlar (spec §4.4). */
export type PublicRewrites = {
  headline: LinkedInRewrites["headline"]
  about: LinkedInRewrites["about"] | { status: "locked" }
  experience: Array<LinkedInRewrites["experience"][number] | { index: number; status: "locked" }>
}
export type AuditLocks = { about: boolean; experience: number } | null

/** Paketi yoksa hakkında ve deneyim yazımları sunucudan hiç çıkmıyor. */
export function lockRewrites(rewrites: LinkedInRewrites, unlocked: boolean): { rewrites: PublicRewrites; locked: AuditLocks } {
  if (unlocked) return { rewrites, locked: null }
  let experience = 0
  return {
    rewrites: {
      headline: rewrites.headline,
      about: rewrites.about.status === "done" ? { status: "locked" } : rewrites.about,
      experience: rewrites.experience.map((e) => {
        if (e.status !== "done") return e
        experience++
        return { index: e.index, status: "locked" as const }
      }),
    },
    locked: { about: rewrites.about.status === "done", experience },
  }
}

export interface AuditView {
  id: string
  status: "running" | "done" | "failed"
  stage: string | null
  source: "extension" | "pdf"
  createdAt: string
  profile: LinkedInProfileData | null
  targetRole: string | null
  analysisIds: string[]
  report: LinkedInAuditReport | null
  rewrites: PublicRewrites | null
  locked: AuditLocks
  /** Düşen yazım varsa ve deneme hakkı kaldıysa true. */
  canRetry: boolean
}

export interface AuditResponse {
  audit: AuditView | null
  previous: { createdAt: string; summary: LinkedInAuditReport["summary"]; sections: Array<{ id: AuditSectionId; status: AuditSectionStatus }> } | null
  unlocked: boolean
}
