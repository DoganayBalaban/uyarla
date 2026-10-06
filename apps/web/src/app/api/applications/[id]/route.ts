import { type Prisma, prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, ensureRegistered, getSession } from "@/server/authz"
import { BOARD_SELECT, toBoardCard } from "@/features/applications/board"
import { applicationPatchSchema } from "@/features/applications/schema"
import { firstIssue } from "@/lib/validation"

export const runtime = "nodejs"

/** Kartın aşamasını ve/veya notunu günceller. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const session = ensureRegistered(await getSession())

    const parsed = applicationPatchSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })
    }
    const body = parsed.data
    const patchData: Prisma.AnalysisUpdateInput = {}

    if (body.stage !== undefined) {
      patchData.stage = body.stage
      patchData.stageChangedAt = new Date()
    }
    if (body.note !== undefined) {
      patchData.note = body.note || null
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
