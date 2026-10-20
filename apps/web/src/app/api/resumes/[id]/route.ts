import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { linkedinReportRequestSchema, resumePatchSchema } from "@/features/resumes/schema"
import { ADAPT_JOB_OPTIONS, LINKEDIN_REPORT_JOB } from "@uyarla/worker/adapt-queue"
import type { LinkedInReportRecord } from "@uyarla/core/linkedin/reportRecord"
import { adaptQueue } from "@/server/adaptQueue"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/server/rateLimit"
import { firstIssue } from "@/lib/validation"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { removeFromLibrary, updateLibraryResume } from "@/server/resumeLibrary"

export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

/** Kütüphanedeki CV'nin LinkedIn raporu (DOG-69); başkasının ya da kütüphanede olmayan CV 404. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  try {
    const { user } = ensureRegistered(await getSession())
    const resume = await prisma.resume.findFirst({
      where: { id, userId: user.id, savedAt: { not: null } },
      select: { id: true, label: true, fileName: true, linkedinReport: true },
    })
    if (!resume) return NextResponse.json({ error: "CV bulunamadı." }, { status: 404 })
    return NextResponse.json({ linkedinReport: resume.linkedinReport ?? null })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/resumes/[id]] GET", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/**
 * LinkedIn profil raporu başlatır (DOG-69). Kayıt "running" yazılıyor, worker
 * PDF'i ayrıştırıp seçilen ilanlara karşı skorluyor; sayfa GET ile yokluyor.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  try {
    const { user } = ensureRegistered(await getSession())
    const parsed = linkedinReportRequestSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })

    const resume = await prisma.resume.findFirst({
      where: { id, userId: user.id, savedAt: { not: null } },
      select: { linkedinReport: true },
    })
    if (!resume) return NextResponse.json({ error: "CV bulunamadı." }, { status: 404 })
    if ((resume.linkedinReport as LinkedInReportRecord | null)?.status === "running") {
      return NextResponse.json({ error: "Raporun hâlâ hazırlanıyor." }, { status: 400 })
    }
    const owned = await prisma.analysis.count({ where: { id: { in: parsed.data.analysisIds }, userId: user.id, status: "done" } })
    if (owned !== parsed.data.analysisIds.length) return NextResponse.json({ error: "Seçilen ilanlardan biri bulunamadı." }, { status: 404 })

    // CV'yi ayrıştırmak bir LLM çağrısı olabiliyor.
    await enforceRateLimit(redisStore, `linkedin:${user.id}`, RATE_LIMITS.registered)
    const record: LinkedInReportRecord = { status: "running", analysisIds: parsed.data.analysisIds, createdAt: new Date().toISOString() }
    await prisma.resume.update({ where: { id }, data: { linkedinReport: record as unknown as object } })
    await adaptQueue.add(LINKEDIN_REPORT_JOB, { resumeId: id }, ADAPT_JOB_OPTIONS)
    return NextResponse.json({ linkedinReport: record }, { status: 202 })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/resumes/[id]] POST", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/** Etiket ve/veya varsayılan yapma. Başkasının ya da kütüphanede olmayan CV 404. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  try {
    const { user } = ensureRegistered(await getSession())
    const parsed = resumePatchSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })
    }
    return NextResponse.json({ resume: await updateLibraryResume(prisma, user.id, id, parsed.data) })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/resumes/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/** Kütüphaneden kaldırır; CV'yle yapılmış analizler panoda kalıyor. */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  try {
    const { user } = ensureRegistered(await getSession())
    await removeFromLibrary(prisma, user.id, id)
    return NextResponse.json({ removed: true })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/resumes/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
