import type { prisma } from "@uyarla/db"

type Db = typeof prisma

/**
 * Ürün haberleri onayı (DOG-130). Ticari elektronik ileti: önceden açık onay
 * gerekiyor (6563 sayılı Kanun) ve onay İleti Yönetim Sistemi'ne (İYS)
 * bildirilmeli. Bu yüzden onayın ne zaman, nereden ve hangi metinle
 * verildiği `EmailConsent`'te saklanıyor; satır silinmiyor, geri alma da yeni
 * bir satır.
 * Metin ve sürümü features/account/consent.ts'de; Hesabım aynı metni gösteriyor.
 */
export { CONSENT_TEXT, CONSENT_TEXT_VERSION } from "@/features/account/consent"
import { CONSENT_TEXT_VERSION } from "@/features/account/consent"

export type ConsentSource = "account" | "unsubscribe"

/** Onayı değiştirir ve geçmişe yazar; durum değişmiyorsa satır eklemez. */
export async function setProductNews(db: Db, userId: string, granted: boolean, source: ConsentSource): Promise<void> {
  const current = await db.user.findUnique({ where: { id: userId }, select: { productNews: true } })
  if (!current || current.productNews === granted) return
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { productNews: granted } }),
    db.emailConsent.create({
      data: { userId, purpose: "productNews", granted, source, textVersion: CONSENT_TEXT_VERSION },
    }),
  ])
}
