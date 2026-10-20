import type { prisma } from "@uyarla/db"
import { Resend } from "resend"
import { LEGAL } from "@/features/legal/company"
import type { MailClient } from "@/server/mail"
import { unsubscribeHeaders, unsubscribeLinks, type EmailCategory } from "@/server/email/unsubscribe"

type Db = typeof prisma

/** İşlem e-postaları kapatılamıyor ve sıklık sınırına girmiyor. */
export type SendCategory = EmailCategory | "transactional"

export interface OutgoingEmail {
  userId: string
  to: string
  category: SendCategory
  subject: string
  html: string
  text: string
  /** EmailLog'a yazılacak satırlar: her biri bir tür ve konu (analiz, dönem). */
  log: Array<{ kind: string; refId?: string }>
}

/** Resend istemcisi; anahtar yoksa null (geliştirme kipi: e-posta gönderilmiyor). */
export function mailClientFromEnv(): MailClient | null {
  const key = process.env.RESEND_API_KEY
  return key ? (new Resend(key) as unknown as MailClient) : null
}

/**
 * Kapatılabilen kategoride imzalı çıkış bağlantısı ve başlıkları
 * (DOG-127). Şablonlar `unsubscribe` adresini alt bilgiye koyuyor.
 */
export function linksFor(userId: string, category: SendCategory): { page: string; oneClick: string } | null {
  return category === "transactional" ? null : unsubscribeLinks(userId, category)
}

/**
 * Gönderir ve kaydeder. `sentAt` aynı e-postanın bütün satırlarında aynı:
 * sıklık sınırı e-postaları bu değerle sayıyor (server/email/daily.ts).
 * Gönderilemezse kayıt yazılmıyor; ertesi gün yeniden deneniyor.
 */
export async function sendLogged(
  db: Db,
  mail: MailClient | null,
  email: OutgoingEmail,
  now: Date,
): Promise<"sent" | "failed" | "skipped"> {
  if (!mail) {
    console.info(`[e-posta] gönderilmedi (RESEND_API_KEY yok): ${email.subject} → ${email.to}`)
    return "skipped"
  }
  const { data, error } = await mail.emails.send({
    from: process.env.EMAIL_FROM ?? "Uyarla <onboarding@resend.dev>",
    to: email.to,
    replyTo: LEGAL.support,
    headers: unsubscribeHeaders(linksFor(email.userId, email.category)),
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  if (error) {
    console.error(`[e-posta] gönderilemedi: ${email.subject}`, error.message)
    return "failed"
  }
  const providerId = (data as { id?: string } | null)?.id ?? null
  // Aynı tür ve konu daha önce yazıldıysa (yarış, yeniden deneme) atlanıyor.
  await db.emailLog.createMany({
    data: email.log.map((l) => ({
      userId: email.userId,
      kind: l.kind,
      refId: l.refId ?? "",
      category: email.category,
      providerId,
      sentAt: now,
    })),
    skipDuplicates: true,
  })
  return "sent"
}
