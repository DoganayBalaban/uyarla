import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { resumePatchSchema } from "@/features/resumes/schema"
import { firstIssue } from "@/lib/validation"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { removeFromLibrary, updateLibraryResume } from "@/server/resumeLibrary"

export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

/** Etiket ve/veya varsayılan yapma. Başkasının ya da kütüphanede olmayan CV 404. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  try {
    const { user } = ensureRegistered(await getSession())
    const parsed = resumePatchSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })
    }
    return NextResponse.json({ resume: await updateLibraryResume(prisma, user.id, id, parsed.data) })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/resumes/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/** Kütüphaneden kaldırır; CV'yle yapılmış analizler panoda kalıyor. */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  try {
    const { user } = ensureRegistered(await getSession())
    await removeFromLibrary(prisma, user.id, id)
    return NextResponse.json({ removed: true })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/resumes/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
