import { prisma } from "@uyarla/db"
import type { LinkedInAuditReport } from "@uyarla/core/linkedin/audit"
import type { LinkedInProfileData } from "@uyarla/core/linkedin/profileData"
import { hasFailedRewrites, type LinkedInRewrites } from "@uyarla/core/linkedin/rewrite"
import { ADAPT_JOB_OPTIONS, LINKEDIN_AUDIT_JOB } from "@uyarla/worker/adapt-queue"
import { NextResponse } from "next/server"
import { z } from "zod"
import { hasLivePass } from "@/features/billing/access"
import { MAX_AUDIT_BODY_BYTES, MAX_RETRIES, auditRequestSchema, lockRewrites, type AuditResponse, type AuditView } from "@/features/linkedin/audit"
import { firstIssue } from "@/lib/validation"
import { adaptQueue } from "@/server/adaptQueue"
import { isAdmin } from "@/server/admin"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { AuditBusyError, createAudit } from "@/server/linkedinAudit"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/server/rateLimit"

export const runtime = "nodejs"

const retrySchema = z.object({ id: z.string().min(1), action: z.literal("retry") })

function failure(error: unknown, where: string) {
  const reply = authErrorResponse(error)
  if (reply) return reply
  console.error(`[api/linkedin/audits] ${where}`, error)
  return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
}

/** En son denetim, önceki taramanın özeti ve kilit bilgisi (DOG-157, spec §6). */
export async function GET() {
  try {
    const { user } = ensureRegistered(await getSession())
    const now = new Date()
    const [rows, passes] = await Promise.all([
      prisma.linkedInAudit.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 2 }),
      prisma.accessPass.findMany({ where: { userId: user.id }, select: { status: true, startsAt: true, endsAt: true } }),
    ])
    const unlocked = isAdmin(user) || hasLivePass(passes, now)
    const [latest, before] = rows
    const prevReport = (before?.report ?? null) as LinkedInAuditReport | null

    let audit: AuditView | null = null
    if (latest) {
      const rewrites = (latest.rewrites ?? null) as LinkedInRewrites | null
      // Kilitli metin bu noktadan sonra yanıtta hiçbir yerde yok (spec §4.4).
      const gated = rewrites ? lockRewrites(rewrites, unlocked) : null
      audit = {
        id: latest.id,
        status: latest.status,
        stage: latest.stage,
        source: latest.source,
        createdAt: latest.createdAt.toISOString(),
        profile: (latest.profile ?? null) as LinkedInProfileData | null,
        targetRole: latest.targetRole,
        analysisIds: latest.analysisIds,
        report: (latest.report ?? null) as LinkedInAuditReport | null,
        rewrites: gated?.rewrites ?? null,
        locked: gated?.locked ?? null,
        canRetry: latest.status === "done" && !!rewrites && hasFailedRewrites(rewrites) && latest.retries < MAX_RETRIES,
      }
    }

    const body: AuditResponse = {
      unlocked,
      audit,
      // Önce/sonra farkı istemcide (sectionDelta); burada yalnızca özet ve bölüm durumları.
      previous:
        before && prevReport ? { createdAt: before.createdAt.toISOString(), summary: prevReport.summary, sections: prevReport.sections.map((s) => ({ id: s.id, status: s.status })) } : null,
    }
    return NextResponse.json(body)
  } catch (error) {
    return failure(error, "GET")
  }
}

/** Yeni tarama (spec §4.1). */
export async function POST(request: Request) {
  try {
    const { user } = ensureRegistered(await getSession())
    const raw = await request.text()
    if (Buffer.byteLength(raw, "utf8") > MAX_AUDIT_BODY_BYTES) {
      return NextResponse.json({ error: "Profil verisi çok büyük. PDF ile dener misin?", code: "too_large" }, { status: 400 })
    }
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: "Profil okunamadı. PDF ile dener misin?", code: "invalid" }, { status: 400 })
    }
    const parsed = auditRequestSchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error).message, code: "invalid" }, { status: 400 })
    const input = parsed.data

    if (input.source === "pdf") {
      const owned = await prisma.resume.count({ where: { id: input.resumeId, userId: user.id } })
      if (!owned) return NextResponse.json({ error: "CV bulunamadı." }, { status: 404 })
    }
    if (input.analysisIds.length > 0) {
      const owned = await prisma.analysis.count({ where: { id: { in: input.analysisIds }, userId: user.id, status: "done" } })
      if (owned !== input.analysisIds.length) return NextResponse.json({ error: "Seçilen ilanlardan biri bulunamadı." }, { status: 404 })
    }

    await enforceRateLimit(redisStore, `linkedin-audit:${user.id}`, RATE_LIMITS.registered)
    await enforceRateLimit(redisStore, `linkedin-audit-gun:${user.id}`, RATE_LIMITS.linkedinAudit)

    const audit = await createAudit(prisma, user.id, {
      source: input.source,
      resumeId: input.source === "pdf" ? input.resumeId : null,
      profile: input.source === "extension" ? input.profile : null,
      targetRole: input.targetRole,
      analysisIds: input.analysisIds,
    })
    await adaptQueue.add(LINKEDIN_AUDIT_JOB, { auditId: audit.id }, ADAPT_JOB_OPTIONS)
    return NextResponse.json({ auditId: audit.id }, { status: 202 })
  } catch (error) {
    if (error instanceof AuditBusyError) return NextResponse.json({ error: error.message, auditId: error.auditId }, { status: 409 })
    return failure(error, "POST")
  }
}

/** Düşen yazımları yeniden dene (spec §6); günlük haktan düşmüyor, tarama başına 3 kez. */
export async function PATCH(request: Request) {
  try {
    const { user } = ensureRegistered(await getSession())
    const parsed = retrySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })
    const audit = await prisma.linkedInAudit.findFirst({ where: { id: parsed.data.id, userId: user.id } })
    if (!audit) return NextResponse.json({ error: "Tarama bulunamadı." }, { status: 404 })
    const rewrites = (audit.rewrites ?? null) as LinkedInRewrites | null
    if (audit.status !== "done" || !rewrites || !hasFailedRewrites(rewrites) || audit.retries >= MAX_RETRIES) {
      return NextResponse.json({ error: "Yeniden denenecek bir şey yok." }, { status: 400 })
    }
    await prisma.linkedInAudit.update({ where: { id: audit.id }, data: { status: "running", stage: "writing", retries: { increment: 1 } } })
    await adaptQueue.add(LINKEDIN_AUDIT_JOB, { auditId: audit.id, retry: true }, ADAPT_JOB_OPTIONS)
    return NextResponse.json({ retried: true }, { status: 202 })
  } catch (error) {
    return failure(error, "PATCH")
  }
}
