import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { plansFromEnv } from "@/features/billing/plans"
import { siteUrl } from "@/lib/site"
import { isAdmin } from "@/server/admin"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { handleCheckout, handleStatus, handleWebhook } from "@/server/billing/handlers"
import { polarProviderFromEnv } from "@/server/billing/polar"

export const runtime = "nodejs"

/**
 * Ödeme uçları tek dosyada (DOG-34): Vercel Hobby 12 fonksiyon sınırının
 * kenarındayız; ayrı dosyalar ayrı fonksiyon demek.
 *   POST /api/billing/checkout   ödeme oturumu
 *   POST /api/billing/webhook    Polar bildirimi (oturum yok, imza var)
 *   GET  /api/billing/status     dönem ve ücretsiz hak
 */
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  try {
    if (action === "webhook") {
      const rawBody = await request.text()
      const headers = Object.fromEntries(request.headers.entries())
      const reply = await handleWebhook({ db: prisma, provider: polarProviderFromEnv(), rawBody, headers, now: new Date() })
      return NextResponse.json(reply.json, { status: reply.status })
    }
    if (action === "checkout") {
      // Review Focus 4: anonim kullanıcı 401 registration_required.
      const session = ensureRegistered(await getSession())
      const reply = await handleCheckout({
        db: prisma,
        provider: polarProviderFromEnv(),
        plans: plansFromEnv(process.env),
        userId: session.user.id,
        body: await request.json().catch(() => ({})),
        baseUrl: siteUrl(),
      })
      return NextResponse.json(reply.json, { status: reply.status })
    }
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("[api/billing]", action, error)
    return NextResponse.json({ error: "Ödeme sayfasını açamadık. Birazdan tekrar dener misin?", code: "unknown" }, { status: 500 })
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  if (action !== "status") return NextResponse.json({ error: "not_found" }, { status: 404 })
  try {
    const session = ensureRegistered(await getSession())
    return NextResponse.json(
      await handleStatus({ db: prisma, userId: session.user.id, now: new Date(), unlimited: isAdmin(session.user) }),
    )
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    throw error
  }
}
