import { z } from "zod"
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

export function isStuck(createdAt: Date, now: Date): boolean {
  return now.getTime() - createdAt.getTime() >= STUCK_MS
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
