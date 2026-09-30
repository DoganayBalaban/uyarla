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
    const oturum = ensureRegistered(await getSession())

    const govde = (await request.json().catch(() => ({}))) as { asama?: unknown; not?: unknown }
    const veri: Prisma.AnalysisUpdateInput = {}

    if (govde.asama !== undefined) {
      if (!isStage(govde.asama)) {
        return NextResponse.json({ error: "Geçersiz aşama." }, { status: 400 })
      }
      veri.stage = govde.asama
      veri.stageChangedAt = new Date()
    }
    if (govde.not !== undefined) {
      if (govde.not !== null && typeof govde.not !== "string") {
        return NextResponse.json({ error: "Geçersiz not." }, { status: 400 })
      }
      const not = (govde.not ?? "").trim()
      if (not.length > NOTE_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Not en fazla ${NOTE_MAX_LENGTH} karakter olabilir.` },
          { status: 400 },
        )
      }
      veri.note = not || null
    }
    if (Object.keys(veri).length === 0) {
      return NextResponse.json({ error: "Güncellenecek bir şey yok." }, { status: 400 })
    }

    const mevcut = await prisma.analysis.findUnique({ where: { id }, select: { userId: true } })
    // Başkasının kaydı da "yok" gibi görünüyor (404), 403 değil: var olduğunu
    // sızdırmamak için (Sprint 3A kararı).
    ensureOwner(mevcut?.userId ?? null, oturum)

    const guncel = await prisma.analysis.update({
      where: { id },
      data: veri,
      select: BOARD_SELECT,
    })
    return NextResponse.json({ kart: toBoardCard(guncel) })
  } catch (error) {
    const yanit = authErrorResponse(error)
    if (yanit) return yanit
    console.error("[api/applications/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
