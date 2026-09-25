import { NextResponse } from "next/server"
import { computeScoreAfter, loadAdaptation } from "@/lib/adaptation"

export const runtime = "nodejs"

/** Durum ve çalışma belgesi. Arayüz çalışırken bunu saniyede bir yokluyor. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const yuk = await loadAdaptation(id)
  if (!yuk) return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })

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
}
