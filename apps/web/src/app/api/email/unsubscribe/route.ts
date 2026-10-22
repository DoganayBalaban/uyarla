import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { verifyUnsubscribe } from "@/server/email/unsubscribe"
import { setProductNews } from "@/server/email/consent"
import { siteUrl } from "@/lib/site"

export const runtime = "nodejs"

/**
 * E-postadan çıkış (DOG-127). İki çağıran var:
 *   - E-posta istemcisinin tek tıkla çıkışı (RFC 8058): gövde
 *     `List-Unsubscribe=One-Click`, yanıt 200 yeterli.
 *   - `/email/unsubscribe` sayfasının formu: işlemden sonra sayfaya geri dönüyor.
 * GET yok: bağlantıyı önceden açan tarayıcı bir şeyi kapatmasın.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t")
  const target = verifyUnsubscribe(token, process.env.EMAIL_LINK_SECRET)
  const body = await request.text().catch(() => "")
  const oneClick = body.includes("List-Unsubscribe=One-Click")

  if (!target) {
    return oneClick
      ? NextResponse.json({ error: "invalid_token" }, { status: 400 })
      : NextResponse.redirect(`${siteUrl()}/email/unsubscribe?hata=1`, 303)
  }

  // Ürün haberleri onaya dayalı: geri alma onay geçmişine yazılıyor (DOG-130).
  // Silinmiş kullanıcı: yapılacak bir şey yok, yine başarılı.
  if (target.category === "productNews") await setProductNews(prisma, target.userId, false, "unsubscribe")
  else await prisma.user.updateMany({ where: { id: target.userId }, data: { [target.category]: false } })

  return oneClick
    ? NextResponse.json({ unsubscribed: true })
    : NextResponse.redirect(`${siteUrl()}/email/unsubscribe?t=${encodeURIComponent(token!)}&tamam=1`, 303)
}
