import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureSession, getSession } from "@/server/authz"

export const runtime = "nodejs"

/**
 * "Tüm ilanlarda hariç tut" listesi (DOG-90). Kimlik yalnızca oturumdan
 * okunuyor; başkasının listesine erişen bir istek biçimi yok. Listeden
 * kaldırmak eski analizlere dokunmuyor, yalnızca sonraki analizleri etkiliyor.
 */
export async function GET() {
  try {
    const { user } = ensureSession(await getSession())
    const concepts = await prisma.excludedConcept.findMany({
      where: { userId: user.id },
      select: { key: true, term: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ concepts })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/excluded-concepts] GET", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { key?: unknown } | null
  if (typeof body?.key !== "string" || !body.key) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
  }
  try {
    const { user } = ensureSession(await getSession())
    await prisma.excludedConcept.deleteMany({ where: { userId: user.id, key: body.key } })
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/excluded-concepts] DELETE", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
