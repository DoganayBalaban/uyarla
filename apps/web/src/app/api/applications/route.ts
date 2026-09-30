import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { BOARD_SELECT, toBoardCard } from "@/features/applications/board"

export const runtime = "nodejs"

/**
 * Başvuru panosu: kullanıcının tamamlanmış analizleri. Kayıtlı kullanıcıya
 * açık — anonim oturumun panosu olmaz, kayıt olunca işleri hesaba taşınıyor.
 */
export async function GET() {
  try {
    const { user } = ensureRegistered(await getSession())

    const satirlar = await prisma.analysis.findMany({
      where: { userId: user.id, status: "done" },
      orderBy: { createdAt: "desc" },
      select: BOARD_SELECT,
    })

    return NextResponse.json({ cards: satirlar.map(toBoardCard) })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/applications]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
