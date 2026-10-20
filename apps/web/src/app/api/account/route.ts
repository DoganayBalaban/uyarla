import { fileStoreFromEnv } from "@uyarla/core/storage/fileStore"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, ensureSession, getSession } from "@/server/authz"
import { deleteAccountBodySchema } from "@/features/account/schema"
import { buildExportZip, collectUserData } from "@/server/dataExport"
import { deleteUsers } from "@/server/deleteAccount"
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/server/rateLimit"
import { mailClientFromEnv } from "@/server/email/send"
import { accountDeletedEmail } from "@/server/email/templates"
import { LEGAL } from "@/features/legal/company"

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
    const body = await readBody(request)
    if (body?.userId) {
      ensureOwner(body.userId, { user })
    }

    // Onay e-postası için adres silmeden önce okunuyor (DOG-129); yalnızca
    // bellekte, gönderimden sonra hiçbir yerde kalmıyor. Anonim hesabın
    // adresi yer tutucu.
    const owner = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, isAnonymous: true } })

    const result = await deleteUsers(prisma, [user.id])

    if (result.deletedUsers === 1 && owner && !owner.isAnonymous) {
      await sendAccountDeleted(owner.email)
    }

    // Oturum satırları da silindi, yani çerez artık hiçbir şeye açılmıyor;
    // ayrıca signOut çağırmak gerekmiyor.
    return NextResponse.json({ deleted: result.deletedUsers === 1 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("[api/account]", error)
    return NextResponse.json(
      { error: "Hesabını silemedik. Birazdan tekrar dener misin?", code: "unknown" },
      { status: 500 },
    )
  }
}

/**
 * "Hesabın silindi" (DOG-129, işlem e-postası). Kayıt yazılmıyor: kullanıcı
 * artık yok. Gönderilemezse silme yine başarılı; kullanıcı ekranda görüyor.
 */
async function sendAccountDeleted(to: string): Promise<void> {
  const mail = mailClientFromEnv()
  if (!mail) return
  const { subject, html, text } = accountDeletedEmail()
  try {
    const { error } = await mail.emails.send({
      from: process.env.EMAIL_FROM ?? "Uyarla <onboarding@resend.dev>",
      to,
      replyTo: LEGAL.support,
      subject,
      html,
      text,
    })
    if (error) console.error("[api/account] silme e-postası gönderilemedi", error.message)
  } catch (error) {
    console.error("[api/account] silme e-postası gönderilemedi", error)
  }
}

/**
 * Gövdeyi okur; gövde yoksa, JSON değilse ya da şemaya uymuyorsa null.
 *
 * DELETE isteklerinin gövdesi isteğe bağlı — arayüz hiç göndermiyor.
 * Bozuk gövde yüzünden silme isteğinin 500 dönmesi kullanıcıyı hesabıyla
 * kilitli bırakırdı.
 */
async function readBody(request: Request): Promise<{ userId?: string } | null> {
  try {
    const bodyText = await request.text()
    if (!bodyText.trim()) return null
    const parsed = deleteAccountBodySchema.safeParse(JSON.parse(bodyText))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * "Verilerimi indir" (DOG-63, KVKK md. 11): oturum sahibinin bütün verisi
 * tek bir ZIP'te.
 *
 * Kimlik yalnızca oturumdan okunuyor; parametre yok. Hesap silmeyle aynı
 * ilke: "başkasının verisini indir" diye bir istek biçimi hiç yok. Anonim
 * oturum da indirebiliyor; onun da depoda CV'si var.
 *
 * Ayrı bir `/api/account/export` route'u değil: Vercel Hobby planı bir
 * deploy'da 12 sunucu fonksiyonuna izin veriyor ve ayrı route 13.'sü
 * oluyordu. Aynı dosyadaki metotlar aynı fonksiyon.
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
