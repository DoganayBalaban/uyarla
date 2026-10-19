import type { Prisma, prisma } from "@uyarla/db"
import { canAdapt, extendPass, type PassLike } from "@/features/billing/access"
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

/**
 * Kullanıcının uyarlama hakkı için gereken sayılar (DOG-34).
 *
 * Ücretsiz hak ayrı bir sayaç değil: başarısız olmayan uyarlamalar sayılıyor.
 * Aynı analizin uyarlamasını yeniden açmak yeni kayıt açmadığı için hak
 * harcamıyor (api/adapt mevcut kaydı döndürüyor).
 */
export async function loadAccess(
  db: Client,
  userId: string,
  now: Date,
): Promise<{ adaptationsUsed: number; adaptationsLast24h: number; passes: PassLike[] }> {
  const mine = { analysis: { userId }, status: { not: "failed" as const } }
  const [adaptationsUsed, adaptationsLast24h, passes] = await Promise.all([
    db.adaptation.count({ where: mine }),
    db.adaptation.count({ where: { ...mine, createdAt: { gt: new Date(now.getTime() - DAY_MS) } } }),
    db.accessPass.findMany({ where: { userId }, select: { status: true, startsAt: true, endsAt: true } }),
  ])
  return { adaptationsUsed, adaptationsLast24h, passes }
}

export class PaymentRequiredError extends Error {
  constructor(readonly code: "payment_required" | "daily_cap") {
    super(
      code === "daily_cap"
        ? "Son 24 saatteki uyarlama sınırına ulaştın. En eski uyarlaman 24 saati doldurunca devam edebilirsin."
        : "Ücretsiz uyarlama hakkını kullandın. Devam etmek için bir paket seç.",
    )
    this.name = "PaymentRequiredError"
  }
}

export async function assertCanAdapt(
  db: Client,
  userId: string,
  now: Date,
  opts: { unlimited?: boolean } = {},
): Promise<void> {
  // Yöneticide sayım bile gereksiz; veritabanına gidilmiyor.
  if (opts.unlimited) return
  const decision = canAdapt({ ...(await loadAccess(db, userId, now)), now })
  if (!decision.allowed) throw new PaymentRequiredError(decision.reason)
}

/**
 * Hakkı kontrol edip uyarlamayı aynı işlemde açar (DOG-77). `create` kilit
 * altında çalışıyor; aynı kullanıcının eşzamanlı ikinci isteği ilkinin
 * kaydını görerek karar veriyor.
 */
export async function withAdaptationAccess<T>(
  db: Db,
  input: { userId: string; now: Date; unlimited?: boolean },
  create: (tx: Client) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await lockUser(tx, input.userId)
    await assertCanAdapt(tx, input.userId, input.now, { unlimited: input.unlimited })
    return create(tx)
  })
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
