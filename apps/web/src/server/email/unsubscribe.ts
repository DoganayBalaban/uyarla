import { createHmac, timingSafeEqual } from "node:crypto"
import { siteUrl } from "@/lib/site"

/**
 * E-postadan tek tıkla çıkış (DOG-127).
 *
 * Bağlantı giriş istemiyor: e-postayı telefonda açan kullanıcı Hesabım'a
 * girmek zorunda kalmasın. Kimlik bağlantının kendisinde, imzalı:
 * `<kullanıcı>.<kategori>.<HMAC>`. Anahtar `EMAIL_LINK_SECRET`; hem web
 * (doğrulama) hem cron servisi (e-postayı imzalama) okuyor. Anahtar yoksa
 * bağlantı üretilmiyor ve e-posta eskisi gibi Hesabım'a yönlendiriyor.
 *
 * İki uç var:
 *   - Sayfa (`/e-posta/cik`): e-postanın altındaki bağlantı. GET bir şey
 *     kapatmıyor, onay istiyor; e-posta tarayıcıları bağlantıları önceden
 *     açabiliyor.
 *   - `POST /api/email/unsubscribe`: sayfanın formu ve e-posta istemcisinin
 *     tek tıkla çıkışı (RFC 8058, `List-Unsubscribe-Post`).
 */
/**
 * Kapatılabilen kategoriler; her biri `User` üzerinde aynı adlı bir anahtar
 * (DOG-126). İşlem e-postaları (giriş, ödeme, hesap silindi) burada yok:
 * kapatılamıyorlar.
 */
export const EMAIL_CATEGORIES = ["applicationReminders", "accessUpdates", "productNews"] as const
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number]

/** Hesabım'daki karşılığı; sayfa kullanıcıya bunu söylüyor. */
export const CATEGORY_LABEL: Record<EmailCategory, string> = {
  applicationReminders: "başvuru hatırlatmaları",
  accessUpdates: "erişim dönemi bilgileri",
  productNews: "ürün haberleri",
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

export function signUnsubscribe(userId: string, category: EmailCategory, secret: string): string {
  const payload = `${userId}.${category}`
  return `${payload}.${signature(payload, secret)}`
}

export function verifyUnsubscribe(
  token: string | null | undefined,
  secret: string | undefined,
): { userId: string; category: EmailCategory } | null {
  if (!token || !secret) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [userId, category, given] = parts as [string, string, string]
  if (!userId || !(EMAIL_CATEGORIES as readonly string[]).includes(category)) return null
  const expected = Buffer.from(signature(`${userId}.${category}`, secret))
  const actual = Buffer.from(given)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  return { userId, category: category as EmailCategory }
}

/** E-postaya konacak iki adres; anahtar yoksa null. */
export function unsubscribeLinks(
  userId: string,
  category: EmailCategory,
  secret: string | undefined = process.env.EMAIL_LINK_SECRET,
): { page: string; oneClick: string } | null {
  if (!secret) return null
  const t = encodeURIComponent(signUnsubscribe(userId, category, secret))
  return { page: `${siteUrl()}/e-posta/cik?t=${t}`, oneClick: `${siteUrl()}/api/email/unsubscribe?t=${t}` }
}

/** Resend'e verilen başlıklar (RFC 2369 ve 8058). */
export function unsubscribeHeaders(links: { oneClick: string } | null): Record<string, string> | undefined {
  if (!links) return undefined
  return { "List-Unsubscribe": `<${links.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
}
