import { NextResponse } from "next/server"
import {
  adaptationDocument,
  computeScoreAfter,
  computeScoreBefore,
  loadAdaptation,
  missingMustRequirements,
} from "@/server/adaptationDecision"
import { authErrorResponse, ensureOwner, getSession } from "@/server/authz"
import { checkCoverLetter } from "@uyarla/core/cover/checks"
import type { CoverLetterRecord } from "@uyarla/core/cover/letter"
import { detectPlatform } from "@/features/analysis/platforms"
import { readFormAnswers } from "@uyarla/core/cover/formAnswerRecord"
import { postingTermsFrom } from "@/features/adaptation/postingTerms"
import { waitingPreview } from "@/features/adaptation/waiting"
import { adaptJobId } from "@uyarla/worker/adapt-queue"
import { adaptQueue } from "@/server/adaptQueue"
import { SCORING_REVISION } from "@uyarla/core/score/config"

export const runtime = "nodejs"

/** Durum ve çalışma belgesi. Arayüz çalışırken bunu saniyede bir yokluyor. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const payload = await loadAdaptation(id)
    if (!payload) return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })

    ensureOwner(payload.ownerId, await getSession())

    const { adaptation, profile, posting, scoringPosting, draft, scoreBefore, scoringRevision, excluded } = payload
    const letter = (adaptation.coverLetter ?? null) as CoverLetterRecord | null
    const running = adaptation.status === "running"

    return NextResponse.json({
      status: adaptation.status,
      // Bekleme ekranı (çalışırken): işin bildirdiği aşama ve üzerinde
      // çalışılan gerçek malzeme. Bitince gönderilmiyor.
      stage: running ? await runningStage(id) : null,
      preview: running ? waitingPreview(profile, adaptation.analysis.result, adaptation.createdAt) : null,
      draft,
      // Eski formülle kaydedilmiş analizde "önce" de bugünkü formülle (DOG-103,
      // DOG-165): "sonra" bugünkü formülle; fark formülden değil CV'den gelsin.
      scoreBefore:
        scoringRevision >= SCORING_REVISION
          ? scoreBefore
          : ((await computeScoreBefore(profile, scoringPosting, draft, excluded)) ?? scoreBefore),
      // Yeni skor yalnızca taslak varken hesaplanıyor; çalışırken boşuna
      // gömme çağrısı yapılmaz.
      scoreAfter: await computeScoreAfter(profile, scoringPosting, draft, excluded),
      errorClass: adaptation.errorClass,
      coverLetter: letter,
      // Ön yazı kontrol listesi (DOG-96): her istekte hesaplanıyor, ucuz ve
      // deterministik; böylece eski ön yazılarda da var.
      coverLetterChecks:
        letter?.status === "done" ? checkCoverLetter(letter.paragraphs.map((p) => p.text), posting) : null,
      document: adaptationDocument(profile, draft, payload.documentOptions),
      missingRequirements: missingMustRequirements(adaptation.analysis.result),
      // İlanın platformuna özel ipuçları indirme panelinin altında (DOG-95).
      platform: detectPlatform(adaptation.analysis.jobPosting.sourceUrl),
      // Başvuru formu yanıtları (DOG-123); istek /api/applications/[analysisId] ucuna.
      analysisId: adaptation.analysisId,
      formAnswers: readFormAnswers(adaptation.analysis.formAnswers),
      // İlan terimleri (DOG-92): belgede vurgu ve yazarken canlı gösterim.
      postingTerms: postingTermsFrom(posting.requirements, { excluded, scoringRevision }),
    })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/adapt/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/** Worker'ın kuyruğa bildirdiği aşama; iş yoksa ya da Redis düştüyse null. */
async function runningStage(id: string): Promise<string | null> {
  try {
    const job = await adaptQueue.getJob(adaptJobId(id))
    const progress = job?.progress as { stage?: unknown } | undefined
    return typeof progress?.stage === "string" ? progress.stage : null
  } catch {
    return null
  }
}
