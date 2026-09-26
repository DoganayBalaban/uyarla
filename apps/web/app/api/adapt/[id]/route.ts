import { NextResponse } from "next/server"
import { computeScoreAfter, loadAdaptation } from "@/lib/adaptation"
import { authErrorResponse, ensureOwner, getSession } from "@/lib/authz"

export const runtime = "nodejs"

/** Durum ve çalışma belgesi. Arayüz çalışırken bunu saniyede bir yokluyor. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const yuk = await loadAdaptation(id)
    if (!yuk) return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })

    ensureOwner(yuk.ownerId, await getSession())

    const { adaptation, profile, posting, draft, scoreBefore } = yuk

    return NextResponse.json({
      status: adaptation.status,
      draft,
      scoreBefore,
      // Yeni skor yalnızca taslak varken hesaplanıyor; çalışırken boşuna
      // gömme çağrısı yapılmaz.
      scoreAfter: await computeScoreAfter(profile, posting, draft),
      errorClass: adaptation.errorClass,
    })
  } catch (error) {
    const yanit = authErrorResponse(error)
    if (yanit) return yanit
    console.error("[api/adapt/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
