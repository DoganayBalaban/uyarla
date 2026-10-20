import { type Prisma } from "@uyarla/db"

/**
 * Başvuru takip hatırlatması (DOG-98). "Başvuruldu"ya alınmış ve o günden
 * beri aşaması değişmemiş başvurular. Jobscan: "Beş gün içinde cevap
 * gelmezse seni dürteceğiz."
 *
 * Gönderim günlük e-posta işinde (server/email/daily.ts): aynı gün mülakat ve
 * son başvuru hatırlatmalarıyla tek e-postada toplanıyor (DOG-128).
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
