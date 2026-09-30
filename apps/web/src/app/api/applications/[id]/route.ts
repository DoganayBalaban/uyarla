import { type Prisma, prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, ensureRegistered, getSession } from "@/server/authz"
import { NOTE_MAX_LENGTH, BOARD_SELECT, isStage, toBoardCard } from "@/features/applications/board"

export const runtime = "nodejs"

/** Kartın aşamasını ve/veya notunu günceller. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const session = ensureRegistered(await getSession())

    const body = (await request.json().catch(() => ({}))) as { stage?: unknown; note?: unknown }
    const patchData: Prisma.AnalysisUpdateInput = {}

    if (body.stage !== undefined) {
      if (!isStage(body.stage)) {
        return NextResponse.json({ error: "Geçersiz aşama." }, { status: 400 })
      }
      patchData.stage = body.stage
      patchData.stageChangedAt = new Date()
    }
    if (body.note !== undefined) {
      if (body.note !== null && typeof body.note !== "string") {
        return NextResponse.json({ error: "Geçersiz not." }, { status: 400 })
      }
      const trimmedNote = (body.note ?? "").trim()
      if (trimmedNote.length > NOTE_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Not en fazla ${NOTE_MAX_LENGTH} karakter olabilir.` },
          { status: 400 },
        )
      }
      patchData.note = trimmedNote || null
    }
    if (Object.keys(patchData).length === 0) {
      return NextResponse.json({ error: "Güncellenecek bir şey yok." }, { status: 400 })
    }

    const existing = await prisma.analysis.findUnique({ where: { id }, select: { userId: true } })
    // Başkasının kaydı da "yok" gibi görünüyor (404), 403 değil: var olduğunu
    // sızdırmamak için (Sprint 3A kararı).
    ensureOwner(existing?.userId ?? null, session)

    const current = await prisma.analysis.update({
      where: { id },
      data: patchData,
      select: BOARD_SELECT,
    })
    return NextResponse.json({ card: toBoardCard(current) })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/applications/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
