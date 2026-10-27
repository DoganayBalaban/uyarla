import type { Prisma, prisma } from "@uyarla/db"
import { decide, extendPass, hasAccess, monthStart, type DenyCode, type Feature, type SubscriptionLike, type Usage } from "@/features/billing/access"
import { isPlanKey } from "@/features/billing/plans"
import type { BillingEvent } from "@/server/billing/provider"

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

/**
 * Sağlayıcı olayını uygular. Sipariş kimliği tekil: aynı bildirim ikinci kez
 * gelirse "duplicate" (Polar 2xx almazsa yeniden deniyor). Bilinmeyen paket ya
 * da silinmiş kullanıcı "ignored": dönem açılmıyor ama istek başarılı sayılıyor,
 * yoksa sağlayıcı sonsuza dek dener. İade yalnızca kendi siparişini kapatıyor.
 */
export async function applyBillingEvent(
  db: Db,
  event: BillingEvent,
  now: Date,
): Promise<"granted" | "duplicate" | "revoked" | "ignored"> {
  if (event.type === "refunded") {
    const found = await db.accessPass.findUnique({ where: { providerOrderId: event.orderId }, select: { userId: true } })
    if (!found) return "ignored"
    return db.$transaction(async (tx) => {
      await lockUser(tx, found.userId)
      return refund(tx, event.orderId, now)
    })
  }

  if (!isPlanKey(event.plan)) return "ignored"
  const plan = event.plan
  return db.$transaction(async (tx) => {
    // Kullanıcı yoksa kilitlenecek satır da yok; sorgu boş dönüyor.
    await lockUser(tx, event.userId)
    if (await tx.accessPass.findUnique({ where: { providerOrderId: event.orderId } })) return "duplicate" as const
    const user = await tx.user.findUnique({ where: { id: event.userId }, select: { id: true } })
    if (!user) return "ignored" as const

    // Kilit altında okunuyor: eşzamanlı ikinci sipariş bunun dönemini görüp
    // ardına ekleniyor.
    const passes = await tx.accessPass.findMany({ where: { userId: user.id }, select: { status: true, startsAt: true, endsAt: true } })
    const range = extendPass(passes, plan, now)
    await tx.accessPass.create({
      data: { userId: user.id, plan, providerOrderId: event.orderId, ...range },
    })
    return "granted" as const
  }).catch((error: unknown) => {
    // Tekil kısıt yine son güvence: kilit kullanıcı satırında, sipariş
    // kimliği başka bir kullanıcıyla gelirse ikincisini bu durduruyor.
    if ((error as { code?: string }).code === "P2002") return "duplicate" as const
    throw error
  })
}

/** İade: yalnızca kendi siparişini kapatıyor; kilit altında çağrılıyor. */
async function refund(tx: Client, orderId: string, now: Date): Promise<"revoked" | "ignored"> {
  const refunded = await tx.accessPass.findUnique({ where: { providerOrderId: orderId } })
  if (!refunded || refunded.status !== "active") return "ignored"
  // Sonraki dönemler iade edilenin bitişine göre üst üste eklenmişti; iade
  // edilen aralık boşalınca onlar da öne kaydırılıyor (süreleri korunuyor).
  // Kaydırılmasa kullanıcı ödediği dönemi eski başlangıç tarihine kadar
  // kullanamıyordu (son gözden geçirme).
  const later = await tx.accessPass.findMany({
    where: { userId: refunded.userId, status: "active", startsAt: { gte: refunded.endsAt } },
    orderBy: { startsAt: "asc" },
  })
  let cursor = new Date(Math.max(now.getTime(), refunded.startsAt.getTime()))
  await tx.accessPass.update({ where: { id: refunded.id }, data: { status: "refunded" } })
  for (const pass of later) {
    const duration = pass.endsAt.getTime() - pass.startsAt.getTime()
    const startsAt = cursor
    cursor = new Date(startsAt.getTime() + duration)
    await tx.accessPass.update({ where: { id: pass.id }, data: { startsAt, endsAt: cursor } })
  }
  return "revoked"
}
