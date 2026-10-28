import type { Prisma, prisma } from "@uyarla/db"
import { decide, hasAccess, monthStart, type DenyCode, type Feature, type SubscriptionLike, type Usage } from "@/features/billing/access"

type Db = typeof prisma
/** İşlem içinde de dışında da çalışan sorgular için; `prisma` buna uyuyor. */
type Client = Prisma.TransactionClient
const DAY_MS = 864e5

/**
 * Kullanıcının satırını işlem bitene kadar kilitler (DOG-77). Hakkı okuyup
 * ona göre yazan iki işlem aynı kullanıcı için sıraya giriyor:
 *   - İki sekmeden aynı anda gelen uyarlama isteği ikisi de "0 kullanıldı"
 *     görüp iki ücretsiz uyarlama açabiliyordu.
 *   - Aynı anda gelen iki ödeme bildirimi aynı "son bitiş"i okuyup çakışan
 *     dönemler açabiliyordu.
 * Kullanıcı başına tek satır, işlem kısa: başka kullanıcıları bekletmiyor.
 */
async function lockUser(tx: Client, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
}

export const SUBSCRIPTION_SELECT = {
  plan: true,
  status: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  trialEnd: true,
  endedAt: true,
  createdAt: true,
} as const

/**
 * Erişim kararı için gereken her şey (DOG-158). Sayaç yok: o ayki kayıtlar
 * sayılıyor. Analiz kaydını worker açtığı için analiz kotası route'un açtığı
 * ilanlardan (JobPosting) sayılıyor; analizi başarısız olan ilan hak yemiyor.
 * Aynı analizin uyarlamasını yeniden açmak yeni kayıt açmadığı için hak
 * harcamıyor (api/adapt mevcut kaydı döndürüyor).
 */
export async function loadUsage(
  db: Client,
  userId: string,
  now: Date,
): Promise<{ subs: Array<SubscriptionLike & { plan: string }>; usage: Usage }> {
  const since = monthStart(now)
  const adaptations = { analysis: { userId }, status: { not: "failed" as const } }
  const [analysesThisMonth, adaptationsThisMonth, adaptationsLast24h, subs] = await Promise.all([
    db.jobPosting.count({ where: { userId, createdAt: { gte: since }, NOT: { analyses: { some: { status: "failed" } } } } }),
    db.adaptation.count({ where: { ...adaptations, createdAt: { gte: since } } }),
    db.adaptation.count({ where: { ...adaptations, createdAt: { gt: new Date(now.getTime() - DAY_MS) } } }),
    db.subscription.findMany({ where: { userId }, select: SUBSCRIPTION_SELECT }),
  ])
  return { subs, usage: { analysesThisMonth, adaptationsThisMonth, adaptationsLast24h } }
}

const DENY_MESSAGE: Record<DenyCode, string> = {
  analysis_quota: "Bu ayki 5 ücretsiz analizini kullandın. Abonelikle sınırsız devam edebilirsin.",
  adaptation_quota: "Bu ayki ücretsiz uyarlamanı kullandın. Abonelikle sınırsız devam edebilirsin.",
  subscription_required: "Bu özellik abonelikte.",
  daily_cap: "Son 24 saatteki uyarlama sınırına ulaştın. En eski uyarlaman 24 saati doldurunca devam edebilirsin.",
}

export class PaymentRequiredError extends Error {
  constructor(readonly code: DenyCode) {
    super(DENY_MESSAGE[code])
    this.name = "PaymentRequiredError"
  }
}

export async function requireEntitlement(
  db: Client,
  input: { userId: string; feature: Feature; now: Date; unlimited?: boolean },
): Promise<void> {
  // Yöneticide sayım bile gereksiz; veritabanına gidilmiyor.
  if (input.unlimited) return
  const { subs, usage } = await loadUsage(db, input.userId, input.now)
  const decision = decide(input.feature, { subs, usage, now: input.now })
  if (!decision.allowed) throw new PaymentRequiredError(decision.code)
}

/**
 * Hakkı kontrol edip kaydı aynı işlemde açar (DOG-77). Kullanıcı satırı
 * kilitli: iki sekmeden gelen istek son ücretsiz hakkı iki kez kullanamıyor;
 * ikinci istek ilkinin kaydını görerek karar veriyor.
 */
export async function withEntitlement<T>(
  db: Db,
  input: { userId: string; feature: Feature; now: Date; unlimited?: boolean },
  create: (tx: Client) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await lockUser(tx, input.userId)
    await requireEntitlement(tx, input)
    return create(tx)
  })
}

/** LinkedIn yazımlarının kilidi ve dışa aktarım (K-106) için. */
export async function userHasAccess(db: Client, userId: string, now: Date): Promise<boolean> {
  return hasAccess(await db.subscription.findMany({ where: { userId }, select: SUBSCRIPTION_SELECT }), now)
}
