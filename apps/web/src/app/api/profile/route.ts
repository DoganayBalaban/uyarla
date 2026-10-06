import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { profilePatchSchema } from "@/features/onboarding/schema"
import { firstIssue } from "@/lib/validation"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { getProfile, updateProfile } from "@/server/profile"

export const runtime = "nodejs"

/** Hesabım sayfasının profil bölümü için. */
export async function GET() {
  try {
    const { user } = ensureRegistered(await getSession())
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
