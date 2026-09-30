import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, ensureSession, getSession } from "@/server/authz"
import { deleteUsers } from "@/server/deleteAccount"

export const runtime = "nodejs"

/**
 * Hesabı ve tüm veriyi siler.
 *
 * Marka rehberi §10.1 güven satırında "İstediğin an silebilirsin" yazıyor ve
 * bu tanıtım sayfasında duruyor; bu uç o sözün karşılığı.
 *
 * Silinecek kimlik YALNIZCA oturumdan okunuyor, gövdeden değil. Böylece
 * "başkasının hesabını sil" diye bir istek biçimi hiç var olmuyor — sızıntıyı
 * kontrolle değil, yüzeyi hiç açmayarak kapatıyoruz.
 *
 * Anonim oturum da silebiliyor: anonim kullanıcının da diskte CV'si var ve
 * söz ona da veriliyor.
 */
export async function DELETE(request: Request) {
  try {
    const { user } = ensureSession(await getSession())

    // Gövde kimlik taşıyorsa oturumla eşleşmek zorunda. Bir istemci hatası
    // sessizce yanlış hesabı silmesin; uymuyorsa 404 (K-35: 403 hesabın var
    // olduğunu sızdırır).
    const govde = await govdeyiOku(request)
    if (govde?.userId) {
      ensureOwner(govde.userId, { user })
    }

    const sonuc = await deleteUsers(prisma, [user.id])

    // Oturum satırları da silindi, yani çerez artık hiçbir şeye açılmıyor;
    // ayrıca signOut çağırmak gerekmiyor.
    return NextResponse.json({ silindi: sonuc.deletedUsers === 1 })
  } catch (error) {
    const yetkiYaniti = authErrorResponse(error)
    if (yetkiYaniti) return yetkiYaniti
    console.error("[api/account]", error)
    return NextResponse.json(
      { error: "Hesabını silemedik. Birazdan tekrar dener misin?", code: "unknown" },
      { status: 500 },
    )
  }
}

/**
 * Gövdeyi okur; gövde yoksa ya da JSON değilse null.
 *
 * DELETE isteklerinin gövdesi isteğe bağlı — arayüz hiç göndermiyor.
 * Bozuk gövde yüzünden silme isteğinin 500 dönmesi kullanıcıyı hesabıyla
 * kilitli bırakırdı.
 */
async function govdeyiOku(request: Request): Promise<{ userId?: string } | null> {
  try {
    const metin = await request.text()
    if (!metin.trim()) return null
    return JSON.parse(metin) as { userId?: string }
  } catch {
    return null
  }
}
