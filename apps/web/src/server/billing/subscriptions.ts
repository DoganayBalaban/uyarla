import * as Sentry from "@sentry/nextjs"
import type { prisma } from "@uyarla/db"
import { grantsAccess } from "@/features/billing/access"
import type { BillingProvider, SubscriptionEvent } from "@/server/billing/provider"

type Db = typeof prisma

/**
 * Abonelik bildirimini uygular (DOG-158): Polar'daki son hâle ekle-ya da-güncelle.
 * Polar bildirimleri sırasız gönderebiliyor; kayıttakinden eski `modifiedAt`
 * yok sayılıyor ("stale"), eşit olan yeniden yazılıyor (aynı bildirim iki kez).
 * Kullanıcı yoksa (hesap silinmiş) "ignored": çağıran aboneliği Polar'da iptal ediyor.
 */
export async function applySubscriptionEvent(db: Db, event: SubscriptionEvent): Promise<"saved" | "stale" | "ignored"> {
  const user = await db.user.findUnique({ where: { id: event.userId }, select: { id: true } })
  if (!user) return "ignored"
  const data = {
    plan: event.plan,
    status: event.status,
    currentPeriodEnd: event.currentPeriodEnd,
    cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    trialEnd: event.trialEnd,
    endedAt: event.endedAt,
    providerUpdatedAt: event.modifiedAt,
    // Eski bildirimde yoksa kayıtlıyı silmesin.
    ...(event.customerId ? { providerCustomerId: event.customerId } : {}),
  }
  return db.$transaction(async (tx) => {
    // Aynı aboneliğin eşzamanlı iki bildirimi sıraya giriyor.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
    const existing = await tx.subscription.findUnique({
      where: { providerSubscriptionId: event.subscriptionId },
      select: { providerUpdatedAt: true },
    })
    if (existing && existing.providerUpdatedAt > event.modifiedAt) return "stale" as const
    await tx.subscription.upsert({
      where: { providerSubscriptionId: event.subscriptionId },
      create: { userId: user.id, providerSubscriptionId: event.subscriptionId, ...data },
      update: data,
    })
    return "saved" as const
  })
}

/**
 * Hesap silinirken açık abonelikleri Polar'da iptal eder; yoksa silinmiş
 * hesaptan ücret çekilmeye devam ederdi. İptal edilemeyenler `failed`'da
 * dönüyor ve hesap silme onlar varken duruyor (K-111; spec §4.3'teki "silme
 * durmuyor" kararının yerine): silinmiş hesabın aboneliğini elle bulmak zor,
 * kullanıcıya "tekrar dene" demek kolay.
 */
export async function revokeOpenSubscriptions(
  db: Db,
  provider: BillingProvider,
  userId: string,
  log: (message: string, extra: unknown) => void = (message, extra) => {
    console.warn(message, extra)
    Sentry.captureMessage(message, { level: "warning", extra: { detail: extra } })
  },
): Promise<{ revoked: number; failed: string[] }> {
  const now = new Date()
  const subs = await db.subscription.findMany({
    where: { userId },
    select: { providerSubscriptionId: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, trialEnd: true, endedAt: true, createdAt: true },
  })
  // Erişim vermeyen ama Polar'ın hâlâ tahsil etmeye çalıştığı (unpaid) da iptal.
  const open = subs.filter((s) => grantsAccess(s, now) || s.status === "past_due" || s.status === "unpaid")
  let revoked = 0
  const failed: string[] = []
  for (const s of open) {
    try {
      await provider.revokeSubscription(s.providerSubscriptionId)
      revoked++
    } catch (error) {
      failed.push(s.providerSubscriptionId)
      log("[billing] abonelik iptal edilemedi; hesap silinmedi", { subscriptionId: s.providerSubscriptionId, error: String(error) })
    }
  }
  return { revoked, failed }
}
