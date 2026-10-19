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

    const { adaptation, profile, posting, draft, scoreBefore, scoringRevision, excluded } = payload
    const letter = (adaptation.coverLetter ?? null) as CoverLetterRecord | null

    return NextResponse.json({
      status: adaptation.status,
      draft,
      // Eski formülle kaydedilmiş analizde "önce" de bugünkü formülle (DOG-103).
      scoreBefore: scoringRevision >= 2 ? scoreBefore : ((await computeScoreBefore(profile, posting, draft, excluded)) ?? scoreBefore),
      // Yeni skor yalnızca taslak varken hesaplanıyor; çalışırken boşuna
      // gömme çağrısı yapılmaz.
      scoreAfter: await computeScoreAfter(profile, posting, draft, excluded),
      errorClass: adaptation.errorClass,
      coverLetter: letter,
      // Ön yazı kontrol listesi (DOG-96): her istekte hesaplanıyor, ucuz ve
      // deterministik; böylece eski ön yazılarda da var.
      coverLetterChecks:
        letter?.status === "done" ? checkCoverLetter(letter.paragraphs.map((p) => p.text), posting) : null,
      document: adaptationDocument(profile, draft),
      missingRequirements: missingMustRequirements(adaptation.analysis.result),
    })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/adapt/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
