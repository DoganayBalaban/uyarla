import { fileStoreFromEnv } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureSession, getSession } from "@/server/authz"
import { buildExportZip, collectUserData } from "@/server/dataExport"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/server/rateLimit"

export const runtime = "nodejs"

/**
 * "Verilerimi indir" (DOG-63, KVKK md. 11): oturum sahibinin bütün verisi
 * tek bir ZIP'te.
 *
 * Kimlik yalnızca oturumdan okunuyor; parametre yok. Hesap silmeyle aynı
 * ilke: "başkasının verisini indir" diye bir istek biçimi hiç yok. Anonim
 * oturum da indirebiliyor; onun da depoda CV'si var.
 */
export async function GET() {
  try {
    const { user } = ensureSession(await getSession())
    await enforceRateLimit(redisStore, `veri-indir:${user.id}`, RATE_LIMITS.dataExport)

    const store = fileStoreFromEnv()
    const data = await collectUserData(prisma, user.id)
    const zip = await buildExportZip(data, (filePath) => store.read(filePath))

    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="uyarla-verilerim-${data.exportedAt.slice(0, 10)}.zip"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("[api/account/export]", error)
    return NextResponse.json({ error: "Verilerini hazırlayamadık. Birazdan tekrar dener misin?" }, { status: 500 })
  }
}
