import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { profilePatchSchema } from "@/features/onboarding/schema"
import { firstIssue } from "@/lib/validation"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { getProfile, updateProfile } from "@/server/profile"
import { forgetFact, listFacts } from "@/server/facts"

export const runtime = "nodejs"

/**
 * Hesabım sayfasının profil bölümü için. `?facts=1`: anlattığın deneyimler
 * (DOG-116). Ayrı route değil: Vercel Hobby'nin fonksiyon sınırı.
 */
export async function GET(request: Request) {
  try {
    const { user } = ensureRegistered(await getSession())
    if (new URL(request.url).searchParams.has("facts")) {
      return NextResponse.json({ facts: await listFacts(prisma, user.id) })
    }
    return NextResponse.json({ profile: await getProfile(prisma, user.id) })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/profile]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/** Ad, amaç, hedef rol; onboarding'i tamamlandı işaretler. Kimlik oturumdan. */
export async function PATCH(request: Request) {
  try {
    const { user } = ensureRegistered(await getSession())
    const parsed = profilePatchSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })
    }
    const profile = await updateProfile(prisma, user.id, parsed.data)
    return NextResponse.json({ profile })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/profile]", error)
    return NextResponse.json({ error: "Profilini kaydedemedik. Birazdan tekrar dener misin?" }, { status: 500 })
  }
}

/** Anlattığın bir deneyimi unutur (DOG-116): sonraki analizlerde kanıt sayılmıyor. */
export async function DELETE(request: Request) {
  try {
    const { user } = ensureRegistered(await getSession())
    const body = (await request.json().catch(() => ({}))) as { factId?: unknown }
    if (typeof body.factId !== "string" || body.factId.length > 200) {
      return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 })
    }
    if (!(await forgetFact(prisma, user.id, body.factId))) {
      return NextResponse.json({ error: "Bu deneyimi bulamadık." }, { status: 404 })
    }
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/profile] DELETE", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
