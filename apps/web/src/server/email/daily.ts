import type { prisma } from "@uyarla/db"
import { positionName, todayInTurkey } from "@/features/applications/board"
import { reminderWhere } from "@/server/applicationReminders"
import type { MailClient } from "@/server/mail"
import { linksFor, sendLogged, type OutgoingEmail } from "@/server/email/send"
import {
  activationFreeUnusedEmail,
  activationNoAnalysisEmail,
  applicationRemindersEmail,
  type ReminderBundle,
} from "@/server/email/templates"

type Db = typeof prisma

/**
 * Günlük e-posta işi (DOG-126..130). Railway cron'u 07:00 UTC'de (10:00 TR)
 * çalıştırıyor. Her tür için bir seçici; sonuçlar kullanıcı başına
 * birleştiriliyor ve kullanıcıya bir günde en fazla bir e-posta gidiyor.
 *
 * Öncelik: başvuru hatırlatmaları (takip, yarınki mülakat, yaklaşan son gün;
 * hepsi tek e-postada) > erişim dönemi bilgisi > ürün haberleri. Sınıra
 * takılan ertesi güne kalıyor.
 *
 * Sıklık sınırı (işlem e-postaları hariç): son 20 saatte e-posta aldıysa
 * bugün yok; son 7 günde 3 e-posta aldıysa yok. Aynı tür ve konu bir kez
 * (EmailLog tekil anahtarı).
 *
 * Ürün haberleri (aktivasyon) iki koşula bağlı: kullanıcının açık onayı ve
 * `PRODUCT_EMAILS_ENABLED=1`. İkincisi İYS kaydından sonra açılmalı (DOG-130).
 */
export const WEEKLY_CAP = 3
const DAILY_GAP_HOURS = 20
const HOUR = 36e5
const DAY = 24 * HOUR
/** Aktivasyon: kayıttan en az 2, en çok 14 gün sonra. */
const ACTIVATION_MIN_DAYS = 2
const ACTIVATION_MAX_DAYS = 14

const addDays = (isoDay: string, n: number) => {
  const d = new Date(`${isoDay}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export interface DailyResult {
  /** E-posta adayı kullanıcılar. */
  users: number
  sent: number
  failed: number
  /** Sıklık sınırı yüzünden bugüne kalmayanlar (ertesi gün yeniden). */
  deferred: number
  byKind: Record<string, number>
}

interface Candidate {
  userId: string
  email: string
  reminders: Required<ReminderBundle> & { refs: Array<{ kind: string; refId: string }>; followupIds: string[] }
  activation: "activation_no_analysis" | "activation_free_unused" | null
}

export async function runDailyEmails(
  db: Db,
  options: { now?: Date; dryRun: boolean; client?: MailClient | null; productEmails?: boolean },
): Promise<DailyResult> {
  const now = options.now ?? new Date()
  const productEmails = options.productEmails ?? process.env.PRODUCT_EMAILS_ENABLED === "1"
  const today = todayInTurkey(now)
  const tomorrow = addDays(today, 1)
  const registered = { isAnonymous: false } as const
  const reminders = { ...registered, applicationReminders: true } as const

  const posting = { select: { position: true, company: true, rawText: true, deadline: true } } as const
  const yesterday = addDays(today, -1)
  const [followups, interviews, deadlines, newUsers, thanks] = await Promise.all([
    db.analysis.findMany({
      where: reminderWhere(now),
      select: { id: true, stageChangedAt: true, user: { select: { id: true, email: true } }, jobPosting: posting },
      orderBy: { stageChangedAt: "asc" },
    }),
    db.analysis.findMany({
      where: { interviewAt: tomorrow, stage: { notIn: ["rejected", "offer"] }, user: reminders },
      select: {
        id: true,
        interviewAt: true,
        user: { select: { id: true, email: true } },
        jobPosting: posting,
        adaptation: { select: { id: true, status: true } },
      },
    }),
    // Uyarlanmış ama başvurulmamış: son gün yarın ya da öbür gün.
    db.analysis.findMany({
      where: {
        stage: "saved",
        adaptation: { status: { in: ["draft", "ready"] } },
        jobPosting: { deadline: { gte: tomorrow, lte: addDays(today, 2) } },
        user: reminders,
      },
      select: {
        id: true,
        user: { select: { id: true, email: true } },
        jobPosting: posting,
        adaptation: { select: { id: true } },
      },
    }),
    productEmails
      ? db.user.findMany({
          where: {
            ...registered,
            productNews: true,
            createdAt: { gte: new Date(now.getTime() - ACTIVATION_MAX_DAYS * DAY), lte: new Date(now.getTime() - ACTIVATION_MIN_DAYS * DAY) },
          },
          select: {
            id: true,
            email: true,
            _count: { select: { resumes: true, analyses: true } },
            analyses: { where: { OR: [{ adaptation: { isNot: null } }, { status: "done" }] }, select: { status: true, adaptation: { select: { id: true } } } },
          },
        })
      : Promise.resolve([]),
    // Dünkü mülakat: teşekkür notu (DOG-117). Aşama hâlâ mülakattaysa.
    db.analysis.findMany({
      where: { interviewAt: yesterday, stage: "interview", user: reminders },
      select: { id: true, user: { select: { id: true, email: true } }, jobPosting: posting },
    }),
  ])

  const candidates = new Map<string, Candidate>()
  const candidate = (userId: string, email: string) => {
    let c = candidates.get(userId)
    if (!c) {
      c = { userId, email, reminders: { followups: [], interviews: [], deadlines: [], thanks: [], refs: [], followupIds: [] }, activation: null }
      candidates.set(userId, c)
    }
    return c
  }

  // Daha önce gönderilenler (takip `reminderSentAt` ile, ötekiler EmailLog ile).
  const sentBefore = new Set(
    (
      await db.emailLog.findMany({
        where: {
          OR: [
            { kind: "interview_reminder", refId: { in: interviews.map((a) => a.id) } },
            { kind: "deadline_reminder", refId: { in: deadlines.map((a) => a.id) } },
            { kind: "thanks_reminder", refId: { in: thanks.map((a) => a.id) } },
            { kind: { in: ["activation_no_analysis", "activation_free_unused"] }, userId: { in: newUsers.map((u) => u.id) } },
          ],
        },
        select: { userId: true, kind: true, refId: true },
      })
    ).map((l) => `${l.userId}|${l.kind}|${l.refId}`),
  )
  const already = (userId: string, kind: string, refId = "") => sentBefore.has(`${userId}|${kind}|${refId}`)

  for (const a of followups) {
    const c = candidate(a.user.id, a.user.email)
    c.reminders.followups.push({
      position: positionName(a.jobPosting.position, a.jobPosting.rawText),
      company: a.jobPosting.company?.trim() || null,
      appliedAt: a.stageChangedAt!,
    })
    c.reminders.refs.push({ kind: "application_followup", refId: a.id })
    c.reminders.followupIds.push(a.id)
  }
  for (const a of interviews) {
    if (already(a.user.id, "interview_reminder", a.id)) continue
    const c = candidate(a.user.id, a.user.email)
    const adaptation = a.adaptation && a.adaptation.status !== "failed" && a.adaptation.status !== "running" ? a.adaptation.id : null
    c.reminders.interviews.push({
      position: positionName(a.jobPosting.position, a.jobPosting.rawText),
      company: a.jobPosting.company?.trim() || null,
      interviewAt: isoDay(a.interviewAt!),
      adaptationId: adaptation,
      analysisId: a.id,
    })
    c.reminders.refs.push({ kind: "interview_reminder", refId: a.id })
  }
  for (const a of deadlines) {
    if (already(a.user.id, "deadline_reminder", a.id)) continue
    const c = candidate(a.user.id, a.user.email)
    c.reminders.deadlines.push({
      position: positionName(a.jobPosting.position, a.jobPosting.rawText),
      company: a.jobPosting.company?.trim() || null,
      deadline: isoDay(a.jobPosting.deadline!),
      adaptationId: a.adaptation?.id ?? null,
    })
    c.reminders.refs.push({ kind: "deadline_reminder", refId: a.id })
  }
  for (const a of thanks) {
    if (already(a.user.id, "thanks_reminder", a.id)) continue
    const c = candidate(a.user.id, a.user.email)
    c.reminders.thanks.push({ position: positionName(a.jobPosting.position, a.jobPosting.rawText), company: a.jobPosting.company?.trim() || null })
    c.reminders.refs.push({ kind: "thanks_reminder", refId: a.id })
  }
  for (const u of newUsers) {
    const adapted = u.analyses.some((a) => a.adaptation)
    const analyzed = u.analyses.some((a) => a.status === "done")
    const kind =
      u._count.resumes > 0 && u._count.analyses === 0
        ? "activation_no_analysis"
        : analyzed && !adapted
          ? "activation_free_unused"
          : null
    if (!kind || already(u.id, kind)) continue
    candidate(u.id, u.email).activation = kind
  }

  // Sıklık sınırı: son 7 gündeki işlem dışı e-postalar, gönderim anına göre.
  const recent = await db.emailLog.findMany({
    where: { userId: { in: [...candidates.keys()] }, category: { not: "transactional" }, sentAt: { gte: new Date(now.getTime() - 7 * DAY) } },
    select: { userId: true, sentAt: true },
  })
  const sends = new Map<string, Set<number>>()
  for (const r of recent) sends.set(r.userId, (sends.get(r.userId) ?? new Set()).add(r.sentAt.getTime()))

  const result: DailyResult = { users: candidates.size, sent: 0, failed: 0, deferred: 0, byKind: {} }
  const mail = options.client === undefined ? null : options.client

  for (const c of candidates.values()) {
    const times = [...(sends.get(c.userId) ?? [])]
    const capped = times.length >= WEEKLY_CAP || times.some((t) => t > now.getTime() - DAILY_GAP_HOURS * HOUR)
    const r = c.reminders
    const email: OutgoingEmail | null =
      r.refs.length > 0
        ? {
            userId: c.userId,
            to: c.email,
            category: "applicationReminders",
            ...applicationRemindersEmail(r, linksFor(c.userId, "applicationReminders")?.page ?? null),
            log: r.refs,
          }
        : c.activation
          ? {
              userId: c.userId,
              to: c.email,
              category: "productNews",
              ...(c.activation === "activation_no_analysis" ? activationNoAnalysisEmail : activationFreeUnusedEmail)(
                linksFor(c.userId, "productNews")?.page ?? null,
              ),
              log: [{ kind: c.activation }],
            }
          : null
    if (!email) continue
    // Ertelenen bir mülakat hatırlatması yarın işe yaramaz; mülakat sınırdan muaf.
    const urgent = r.interviews.length > 0
    if (capped && !urgent) {
      result.deferred++
      continue
    }
    // Aynı gün kalan aktivasyon e-postası ertesi güne.
    if (email.category === "applicationReminders" && c.activation) result.deferred++
    for (const l of email.log) result.byKind[l.kind] = (result.byKind[l.kind] ?? 0) + 1
    if (options.dryRun) continue

    const outcome = await sendLogged(db, mail, email, now)
    if (outcome === "sent") {
      result.sent++
      // Takip hatırlatmasının eski işareti de: seçici ona bakıyor (DOG-98).
      if (r.followupIds.length && email.category === "applicationReminders") {
        await db.analysis.updateMany({ where: { id: { in: r.followupIds } }, data: { reminderSentAt: now } })
      }
    } else if (outcome === "failed") {
      result.failed++
    }
  }
  return result
}
