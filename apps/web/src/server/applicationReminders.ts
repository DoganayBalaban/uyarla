import { type Prisma, type PrismaClient } from "@uyarla/db"
import { Resend } from "resend"
import { positionName } from "@/features/applications/board"
import { siteUrl } from "@/lib/site"
import { LEGAL } from "@/features/legal/company"
import { FONT, emailButton, emailShell, escapeHtml, type MailClient } from "@/server/mail"
import { unsubscribeHeaders, unsubscribeLinks } from "@/server/email/unsubscribe"

/**
 * Başvuru takip hatırlatması (DOG-98). "Başvuruldu"ya alınmış ve o günden
 * beri aşaması değişmemiş başvurular için kullanıcıya tek bir e-posta.
 * Jobscan: "Beş gün içinde cevap gelmezse seni dürteceğiz."
 */

/** "Başvuruldu"dan bu kadar gün sonra hatırlatılıyor. */
export const REMINDER_DAYS = 7
/**
 * Bundan eski başvurular hatırlatılmıyor: özellik açıldığı gün haftalar önce
 * başvurulmuş kartlar için toplu e-posta gitmesin.
 */
export const REMINDER_WINDOW_DAYS = 21

const DAY = 24 * 60 * 60 * 1000

/** Hatırlatılacak başvurular: her başvuru en çok bir kez. */
export function reminderWhere(now: Date): Prisma.AnalysisWhereInput {
  return {
    stage: "applied",
    reminderSentAt: null,
    stageChangedAt: {
      lte: new Date(now.getTime() - REMINDER_DAYS * DAY),
      gte: new Date(now.getTime() - REMINDER_WINDOW_DAYS * DAY),
    },
    // Anonim hesabın e-postası yer tutucu; kullanıcı kapattıysa gönderilmiyor.
    user: { isAnonymous: false, applicationReminders: true },
  }
}

export interface ReminderItem {
  position: string
  company: string | null
  appliedAt: Date
}

const SUBJECT = "Başvurularından haber var mı?"

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" })

/**
 * `unsubscribe`: imzalı çıkış sayfası (DOG-127). Yoksa (anahtar tanımlı
 * değil) eskisi gibi Hesabım'a yönlendiriliyor.
 */
export function reminderEmail(
  items: ReminderItem[],
  unsubscribe: string | null = null,
): { subject: string; html: string; text: string } {
  const board = `${siteUrl()}/applications`
  const account = `${siteUrl()}/account`
  const line = (i: ReminderItem) =>
    `${i.position}${i.company ? ` · ${i.company}` : ""} (${DATE.format(i.appliedAt)} tarihinde başvurdun)`
  const list = items
    .map(
      (i) =>
        `<li style="margin:0 0 8px;">${escapeHtml(i.position)}${i.company ? ` <span style="color:#64748b;">· ${escapeHtml(i.company)}</span>` : ""}<br><span style="font-size:13px;color:#64748b;">${escapeHtml(DATE.format(i.appliedAt))} tarihinde başvurdun</span></li>`,
    )
    .join("")
  const html = emailShell({
    title: SUBJECT,
    preheader: "Bir haftadır ses çıkmayan başvurular için kısa bir hatırlatma.",
    content: `            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;color:#111114;">${SUBJECT}</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Bir haftadır aşaması değişmeyen ${items.length === 1 ? "bir başvurun" : `${items.length} başvurun`} var. Cevap geldiyse panoda güncelle; gelmediyse kısa bir takip e-postası atmanın tam zamanı.</p>
            <ul style="margin:0 0 28px;padding-left:20px;font-family:${FONT};font-size:15px;line-height:1.5;color:#111114;">${list}</ul>
            ${emailButton(board, "Başvuru panosunu aç")}`,
    footer: `Bu hatırlatmayı her başvuru için bir kez gönderiyoruz. ${
      unsubscribe
        ? `İstemiyorsan <a href="${escapeHtml(unsubscribe)}" style="color:#2f4be0;">tek tıkla kapatabilirsin</a>.`
        : `İstemiyorsan <a href="${escapeHtml(account)}" style="color:#2f4be0;">Hesabım</a> sayfasından kapatabilirsin.`
    } Bu e-postayı yanıtlarsan bize ulaşır.<br>
            uyarla · Her ilana, doğru CV.`,
  })
  const text = [
    SUBJECT,
    "",
    "Bir haftadır aşaması değişmeyen başvuruların:",
    ...items.map((i) => `- ${line(i)}`),
    "",
    "Cevap geldiyse panoda güncelle; gelmediyse kısa bir takip e-postası atmanın tam zamanı.",
    board,
    "",
    unsubscribe ? `Bu hatırlatmaları kapatmak için: ${unsubscribe}` : `Bu hatırlatmaları Hesabım sayfasından kapatabilirsin: ${account}`,
  ].join("\n")
  return { subject: SUBJECT, html, text }
}

export interface ReminderResult {
  users: number
  applications: number
  sent: number
  failed: number
}

/**
 * Hatırlatmaları gönderir. Kullanıcı başına tek e-posta; gönderilen
 * başvuruların `reminderSentAt`'i işaretleniyor. Gönderilemeyen kullanıcının
 * başvuruları işaretlenmiyor, ertesi gün yeniden deneniyor.
 * `dryRun`'da yalnızca sayıyor.
 */
export async function sendApplicationReminders(
  db: PrismaClient,
  options: { now?: Date; dryRun: boolean; client?: MailClient },
): Promise<ReminderResult> {
  const now = options.now ?? new Date()
  const rows = await db.analysis.findMany({
    where: reminderWhere(now),
    select: {
      id: true,
      stageChangedAt: true,
      user: { select: { id: true, email: true } },
      jobPosting: { select: { position: true, company: true, rawText: true } },
    },
    orderBy: { stageChangedAt: "asc" },
  })

  const byUser = new Map<string, { userId: string; email: string; ids: string[]; items: ReminderItem[] }>()
  for (const r of rows) {
    const entry = byUser.get(r.user.id) ?? { userId: r.user.id, email: r.user.email, ids: [], items: [] }
    entry.ids.push(r.id)
    entry.items.push({
      position: positionName(r.jobPosting.position, r.jobPosting.rawText),
      company: r.jobPosting.company?.trim() || null,
      appliedAt: r.stageChangedAt!,
    })
    byUser.set(r.user.id, entry)
  }

  const result: ReminderResult = { users: byUser.size, applications: rows.length, sent: 0, failed: 0 }
  // Gönderilecek bir şey yoksa e-posta anahtarı da gerekmiyor: cron her gün
  // çalışıyor ve boş günlerde hata vermemeli.
  if (options.dryRun || byUser.size === 0) return result

  const key = process.env.RESEND_API_KEY
  if (!key && !options.client) throw new Error("RESEND_API_KEY yok; hatırlatma gönderilemez.")
  const mail = options.client ?? (new Resend(key) as unknown as MailClient)

  for (const entry of byUser.values()) {
    const links = unsubscribeLinks(entry.userId, "applicationReminders")
    const { subject, html, text } = reminderEmail(entry.items, links?.page ?? null)
    const { error } = await mail.emails.send({
      from: process.env.EMAIL_FROM ?? "Uyarla <onboarding@resend.dev>",
      to: entry.email,
      // Yanıtlar okunsun (DOG-127): gönderen noreply, yanıt destek adresine.
      replyTo: LEGAL.support,
      headers: unsubscribeHeaders(links),
      subject,
      html,
      text,
    })
    if (error) {
      // Bir kullanıcıya gidememesi diğerlerini durdurmuyor; işaretlenmeyen
      // başvuru ertesi gün yeniden deneniyor.
      console.error(`[hatırlatma] gönderilemedi: ${error.message}`)
      result.failed++
      continue
    }
    await db.analysis.updateMany({ where: { id: { in: entry.ids } }, data: { reminderSentAt: now } })
    result.sent++
  }
  return result
}
