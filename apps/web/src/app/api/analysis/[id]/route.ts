import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, getSession } from "@/server/authz"
import { conceptKey, correctPosting, positionInPosting } from "@uyarla/core/score/exclusions"
import { scoreProfile } from "@uyarla/core/score/live"
import { analysisProfile, markFactEvidence } from "@uyarla/core/adapt/facts"
import { markDeclarationEvidence, removeDeclaration, upsertDeclaration, type Declaration } from "@uyarla/core/adapt/declarations"
import type { ScoreResult } from "@uyarla/core/score/score"
import type { JobPostingData } from "@uyarla/core/schemas/job"
import type { ResumeProfile } from "@uyarla/core/schemas/resume"
import { cachedEmbedding } from "@/server/adaptationDecision"
import { checkDeclaration, declareContext } from "@/server/declarations"
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
      include: {
        jobPosting: { select: { sourceUrl: true, rawText: true } },
        resumeVersion: { select: { profile: true } },
        adaptation: { select: { id: true } },
      },
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
      declare: declareContext(analysis!),
      platform: detectPlatform(analysis!.jobPosting.sourceUrl),
      // Bilinmeyen ya da taklit alan adında uyarı (DOG-125).
      sourceWarning: postingSourceWarning(classifyPostingSource(analysis!.jobPosting.sourceUrl)),
      // İlan metni sekmesi (DOG-133).
      postingText: analysis!.jobPosting.rawText ?? null,
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
 * - `position`: ilanın unvanını düzelt (DOG-134). Yalnızca ilan metninde geçen
 *   bir unvan kabul ediliyor; unvan eşleşmesi ve skor yeniden hesaplanıyor.
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
      include: { jobPosting: true, resumeVersion: true, adaptation: { select: { id: true } } },
    })
    ensureOwner(analysis?.userId ?? null, await getSession())
    if (analysis!.status !== "done" || !analysis!.result) {
      return NextResponse.json({ error: "Analiz henüz tamamlanmadı." }, { status: 409 })
    }

    const result = analysis!.result as unknown as StoredResult
    if (patch.action !== "position" && patch.requirementIndex >= result.requirements.length) {
      return NextResponse.json({ error: "Gereksinim bulunamadı." }, { status: 404 })
    }

    // Analiz başına tek uyarlama var; taslak bu beyanlarla kuruldu.
    if ((patch.action === "declare" || patch.action === "undeclare") && analysis!.adaptation) {
      return NextResponse.json({ error: "Uyarlama başladıktan sonra eklenemiyor." }, { status: 409 })
    }

    let updated: StoredResult
    let remember: string[] = []
    if (patch.action === "exclude") {
      ;({ result: updated, remember } = markRequirement(result, patch.requirementIndex, patch, new Date().toISOString()))
    } else if (patch.action === "include") {
      updated = unmarkRequirement(result, patch.requirementIndex)
    } else {
      const posting = postingOf(analysis!.jobPosting)
      let corrections = result.corrections ?? {}
      let position = result.positionCorrection ?? null
      if (patch.action === "correct") {
        const type = posting.requirements[patch.requirementIndex]?.type
        // Yıl yalnız deneyimde, terim yalnız eğitimde düzeltiliyor; CV hakkında beyan alınmıyor.
        if ((patch.minYears != null && type !== "experience") || (patch.terms != null && type !== "education")) {
          return NextResponse.json({ error: "Bu şart düzeltilemiyor." }, { status: 422 })
        }
        corrections = mergeCorrection(result.corrections, patch.requirementIndex, patch)
      } else if (patch.action === "position") {
        // İlanın düzeltmesi, CV hakkında beyan değil: unvan ilanda geçmeli.
        if (patch.position !== null && !positionInPosting(analysis!.jobPosting.rawText, patch.position)) {
          return NextResponse.json({ error: "Bu unvan ilan metninde geçmiyor." }, { status: 422 })
        }
        position = patch.position === posting.position ? null : patch.position
      }
      const stored = (analysis!.resumeVersion?.profile ?? null) as ResumeProfile | null
      if (!stored) return NextResponse.json({ error: "Bu analizin CV'si bulunamadı." }, { status: 409 })
      let declarations = result.declarations
      if (patch.action === "declare") {
        const verdict = checkDeclaration(patch.declaration, result.requirements[patch.requirementIndex]!, analysisProfile(stored, result))
        if (verdict !== "ok") return NextResponse.json({ error: "Bu gereksinime eklenemiyor." }, { status: 422 })
        const declaration = { ...patch.declaration, requirementIndex: patch.requirementIndex, at: new Date().toISOString() }
        declarations = upsertDeclaration(declarations ?? [], declaration)
      } else if (patch.action === "undeclare") {
        declarations = removeDeclaration(declarations ?? [], patch.requirementIndex)
      }
      // Analize katılan olgular (DOG-116) ve beyanlar (K-114) yeniden hesapta da kanıt.
      const profile = analysisProfile(stored, { ...result, declarations })

      const fresh = markDeclarationEvidence(
        markFactEvidence(
          await scoreProfile({ profile, posting: correctPosting(posting, corrections, position) }, cachedEmbedding()),
          result.facts ?? [],
        ),
        declarations ?? [],
      )
      updated = {
        ...result,
        requirements: fresh.requirements,
        missingKeywords: fresh.missingKeywords,
        titleMatch: fresh.titleMatch,
        // Yeniden hesap güncel formülle; eski analizde de sürüm onu söylemeli.
        scoringRevision: fresh.scoringRevision,
        corrections,
        positionCorrection: position ?? undefined,
        ...(declarations ? { declarations } : {}),
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

type StoredResult = ScoreResult & { format?: unknown; declarations?: Declaration[] }

function postingOf(row: { position: string; company: string | null; seniority: string | null; language: string; requirements: unknown }): JobPostingData {
  return {
    position: row.position,
    company: row.company,
    seniority: row.seniority as JobPostingData["seniority"],
    language: row.language as JobPostingData["language"],
    requirements: row.requirements as JobPostingData["requirements"],
  }
}
