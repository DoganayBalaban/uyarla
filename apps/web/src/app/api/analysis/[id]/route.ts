import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, getSession } from "@/server/authz"
import { conceptKey, correctPosting } from "@uyarla/core/score/exclusions"
import { scoreProfile } from "@uyarla/core/score/live"
import { analysisProfile, markFactEvidence } from "@uyarla/core/adapt/facts"
import type { ScoreResult } from "@uyarla/core/score/score"
import type { JobPostingData } from "@uyarla/core/schemas/job"
import type { ResumeProfile } from "@uyarla/core/schemas/resume"
import { cachedEmbedding } from "@/server/adaptationDecision"
import { detectPlatform } from "@/features/analysis/platforms"
import { classifyPostingSource, postingSourceWarning } from "@/features/analysis/postingSource"
import {
  markRequirement,
  mergeCorrection,
  parseAnalysisPatch,
  scoreWithExclusions,
  unmarkRequirement,
} from "@/server/requirementExclusion"

export const runtime = "nodejs"

/**
 * Bir analizin sonucu, analiz kimliğiyle.
 *
 * `/api/analyze/[jobId]` kuyruk işine bakıyor ve iş kuyruktan temizlenince
 * sonuç kayboluyordu; sayfa yenilenince de iş kimliği elde kalmıyordu (K3).
 * Analiz kaydı kalıcı: `/analyze?analiz=<id>` bu uçtan besleniyor, panodaki
 * kart ve sağ alttaki bildirim de buraya bağlanıyor.
 *
 * Yanıt biçimi `/api/analyze/[jobId]`'nin "completed" yanıtıyla aynı ki
 * analiz sayfası ikisini aynı kodla gösterebilsin.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const analysis = await prisma.analysis.findUnique({
      where: { id },
      include: { jobPosting: { select: { sourceUrl: true } } },
    })
    ensureOwner(analysis?.userId ?? null, await getSession())

    if (analysis!.status === "running") return NextResponse.json({ status: "running" })
    if (analysis!.status === "failed") {
      return NextResponse.json({ status: "failed", error: "Bu analiz tamamlanamadı." })
    }

    return NextResponse.json({
      status: "completed",
      analysisId: analysis!.id,
      score: analysis!.score,
      result: analysis!.result,
      durationMs: analysis!.durationMs,
      tokenUsage: analysis!.tokenUsage,
      // İlan adresinden tanınan platform (DOG-95); ipuçları istemcide.
      platform: detectPlatform(analysis!.jobPosting.sourceUrl),
      // Bilinmeyen ya da taklit alan adında uyarı (DOG-125).
      sourceWarning: postingSourceWarning(classifyPostingSource(analysis!.jobPosting.sourceUrl)),
      modelId: analysis!.modelId,
    })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/analysis/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/**
 * Gereksinim işaretleri ve şart düzeltmesi (DOG-90). Gövde `action` alanıyla:
 * - `exclude`: nedenle işaretle; `always` ise kavramlar kalıcı listeye de
 *   yazılıyor. "CV'mde var" (`found_in_cv`) hariç tutmuyor, bildirim.
 * - `include`: işareti kaldır.
 * - `correct`: ilanın şartını düzelt (deneyimde en az yıl, eğitimde terimler);
 *   sonuç kayıtlı CV profiliyle yeniden hesaplanıyor (LLM yok, gömmeler
 *   önbellekten).
 * İlk skor sonucun içinde (result.score) kalıyor; Analysis.score düzeltilmiş
 * skor (K-67).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const patch = parseAnalysisPatch(await request.json().catch(() => null))
  if (!patch) return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })

  try {
    const analysis = await prisma.analysis.findUnique({
      where: { id },
      include: { jobPosting: true, resumeVersion: true },
    })
    ensureOwner(analysis?.userId ?? null, await getSession())
    if (analysis!.status !== "done" || !analysis!.result) {
      return NextResponse.json({ error: "Analiz henüz tamamlanmadı." }, { status: 409 })
    }

    const result = analysis!.result as unknown as StoredResult
    if (patch.requirementIndex >= result.requirements.length) {
      return NextResponse.json({ error: "Gereksinim bulunamadı." }, { status: 404 })
    }

    let updated: StoredResult
    let remember: string[] = []
    if (patch.action === "exclude") {
      ;({ result: updated, remember } = markRequirement(result, patch.requirementIndex, patch, new Date().toISOString()))
    } else if (patch.action === "include") {
      updated = unmarkRequirement(result, patch.requirementIndex)
    } else {
      const posting = postingOf(analysis!.jobPosting)
      const type = posting.requirements[patch.requirementIndex]?.type
      // Yıl yalnız deneyimde, terim yalnız eğitimde düzeltiliyor; CV hakkında beyan alınmıyor.
      if ((patch.minYears != null && type !== "experience") || (patch.terms != null && type !== "education")) {
        return NextResponse.json({ error: "Bu şart düzeltilemiyor." }, { status: 422 })
      }
      const stored = (analysis!.resumeVersion?.profile ?? null) as ResumeProfile | null
      if (!stored) return NextResponse.json({ error: "Bu analizin CV'si bulunamadı." }, { status: 409 })
      // Analize katılan olgular (DOG-116) yeniden hesapta da kanıt.
      const profile = analysisProfile(stored, result)

      const corrections = mergeCorrection(result.corrections, patch.requirementIndex, patch)
      const fresh = markFactEvidence(
        await scoreProfile({ profile, posting: correctPosting(posting, corrections) }, cachedEmbedding()),
        result.facts ?? [],
      )
      updated = {
        ...result,
        requirements: fresh.requirements,
        missingKeywords: fresh.missingKeywords,
        titleMatch: fresh.titleMatch,
        // Yeniden hesap güncel formülle; eski analizde de sürüm onu söylemeli.
        scoringRevision: fresh.scoringRevision,
        corrections,
      }
    }

    const score = scoreWithExclusions(updated, updated.excluded ?? [])
    await prisma.$transaction([
      ...remember.map((term) =>
        prisma.excludedConcept.upsert({
          where: { userId_key: { userId: analysis!.userId, key: conceptKey(term) } },
          create: { userId: analysis!.userId, key: conceptKey(term), term },
          update: {},
        }),
      ),
      prisma.analysis.update({ where: { id }, data: { result: updated as object, score } }),
    ])
    return NextResponse.json({ result: updated, score })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/analysis/[id]] PATCH", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

type StoredResult = ScoreResult & { format?: unknown }

function postingOf(row: { position: string; company: string | null; seniority: string | null; language: string; requirements: unknown }): JobPostingData {
  return {
    position: row.position,
    company: row.company,
    seniority: row.seniority as JobPostingData["seniority"],
    language: row.language as JobPostingData["language"],
    requirements: row.requirements as JobPostingData["requirements"],
  }
}
