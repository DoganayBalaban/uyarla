import type { prisma } from "@uyarla/db"
import { canAdapt, extendPass, type PassLike } from "@/features/billing/access"
import { isPlanKey } from "@/features/billing/plans"
import type { BillingEvent } from "@/server/billing/provider"

type Db = typeof prisma
const DAY_MS = 864e5

/**
 * Kullanıcının uyarlama hakkı için gereken sayılar (DOG-34).
 *
 * Ücretsiz hak ayrı bir sayaç değil: başarısız olmayan uyarlamalar sayılıyor.
 * Aynı analizin uyarlamasını yeniden açmak yeni kayıt açmadığı için hak
 * harcamıyor (api/adapt mevcut kaydı döndürüyor).
 */
export async function loadAccess(
  db: Db,
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

export async function assertCanAdapt(db: Db, userId: string, now: Date): Promise<void> {
  const decision = canAdapt({ ...(await loadAccess(db, userId, now)), now })
  if (!decision.allowed) throw new PaymentRequiredError(decision.reason)
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
    const refunded = await db.accessPass.findUnique({ where: { providerOrderId: event.orderId } })
    if (!refunded || refunded.status !== "active") return "ignored"
    // Sonraki dönemler iade edilenin bitişine göre üst üste eklenmişti; iade
    // edilen aralık boşalınca onlar da öne kaydırılıyor (süreleri korunuyor).
    // Kaydırılmasa kullanıcı ödediği dönemi eski başlangıç tarihine kadar
    // kullanamıyordu (son gözden geçirme).
    const later = await db.accessPass.findMany({
      where: { userId: refunded.userId, status: "active", startsAt: { gte: refunded.endsAt } },
      orderBy: { startsAt: "asc" },
    })
    let cursor = new Date(Math.max(now.getTime(), refunded.startsAt.getTime()))
    await db.$transaction([
      db.accessPass.update({ where: { id: refunded.id }, data: { status: "refunded" } }),
      ...later.map((pass) => {
        const duration = pass.endsAt.getTime() - pass.startsAt.getTime()
        const startsAt = cursor
        cursor = new Date(startsAt.getTime() + duration)
        return db.accessPass.update({ where: { id: pass.id }, data: { startsAt, endsAt: cursor } })
      }),
    ])
    return "revoked"
  }

  if (!isPlanKey(event.plan)) return "ignored"
  if (await db.accessPass.findUnique({ where: { providerOrderId: event.orderId } })) return "duplicate"
  const user = await db.user.findUnique({ where: { id: event.userId }, select: { id: true } })
  if (!user) return "ignored"

  const passes = await db.accessPass.findMany({ where: { userId: user.id }, select: { status: true, startsAt: true, endsAt: true } })
  const range = extendPass(passes, event.plan, now)
  try {
    await db.accessPass.create({
      data: { userId: user.id, plan: event.plan, providerOrderId: event.orderId, ...range },
    })
  } catch (error) {
    // Aynı anda gelen iki bildirim: tekil kısıt ikincisini durduruyor.
    if ((error as { code?: string }).code === "P2002") return "duplicate"
    throw error
  }
  return "granted"
}
