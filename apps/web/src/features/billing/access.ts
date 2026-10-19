import { PLAN_DAYS, type PlanKey } from "@/features/billing/plans"

/** Ücretsiz plan: ömür boyu bir uyarlama (spec §2). */
export const FREE_ADAPTATIONS = 1
/** Dönem içinde son 24 saatte en çok uyarlama; kötüye kullanım koruması. */
export const DAILY_CAP = 30

const DAY_MS = 864e5

export interface PassLike {
  status: "active" | "refunded"
  startsAt: Date
  endsAt: Date
}

function isLive(pass: PassLike, now: Date): boolean {
  return pass.status === "active" && pass.startsAt <= now && now < pass.endsAt
}

export type AdaptDecision =
  | { allowed: true; via: "free" | "pass" | "admin" }
  | { allowed: false; reason: "payment_required" | "daily_cap" }

/**
 * Uyarlama hakkı. Dönem varsa dönem kullanılıyor; yoksa ücretsiz hak. Günlük
 * tavan yalnızca dönemde: ücretsiz hak zaten bir.
 *
 * Ücretsiz hak ayrı bir sayaç değil, başarısız olmayan bütün uyarlamaların
 * sayısı (`adaptationsUsed`); dönem içindekiler de giriyor. Ücretsiz hakkını
 * kullanmadan paket alan kullanıcının dönemdeki ilk uyarlaması onu da
 * harcıyor ve dönem bitince ücretsiz hak kalmıyor (DOG-80: eski yorum "saklı
 * kalır" diyordu).
 */
export function canAdapt(input: {
  adaptationsUsed: number
  adaptationsLast24h: number
  passes: PassLike[]
  now: Date
  /** Yönetici: ödeme duvarı ve günlük tavan yok (server/admin.ts). */
  unlimited?: boolean
}): AdaptDecision {
  if (input.unlimited) return { allowed: true, via: "admin" }
  if (input.passes.some((p) => isLive(p, input.now))) {
    return input.adaptationsLast24h >= DAILY_CAP ? { allowed: false, reason: "daily_cap" } : { allowed: true, via: "pass" }
  }
  return input.adaptationsUsed < FREE_ADAPTATIONS ? { allowed: true, via: "free" } : { allowed: false, reason: "payment_required" }
}

/** Aktif dönemlerin en geç bitişi; yoksa null. Gelecekte başlayan (üst üste eklenmiş) dönem de sayılır. */
export function activePassEnd(passes: PassLike[], now: Date): Date | null {
  const ends = passes.filter((p) => p.status === "active" && now < p.endsAt).map((p) => p.endsAt.getTime())
  return ends.length ? new Date(Math.max(...ends)) : null
}

/** Yeni paketin aralığı: aktif dönem varsa en geç bitişin üstüne eklenir. */
export function extendPass(passes: PassLike[], plan: PlanKey, now: Date): { startsAt: Date; endsAt: Date } {
  const startsAt = activePassEnd(passes, now) ?? now
  return { startsAt, endsAt: new Date(startsAt.getTime() + PLAN_DAYS[plan] * DAY_MS) }
}

/** Kullanıcıya gösterilen hak durumu (DOG-81); sunucu `GET /api/billing/status` ile döndürüyor. */
export function accessSnapshot(input: {
  adaptationsUsed: number
  adaptationsLast24h: number
  passes: PassLike[]
  now: Date
}): { passEndsAt: Date | null; freeLeft: number; usedLast24h: number; dailyCap: number } {
  return {
    passEndsAt: activePassEnd(input.passes, input.now),
    freeLeft: Math.max(0, FREE_ADAPTATIONS - input.adaptationsUsed),
    usedLast24h: input.adaptationsLast24h,
    dailyCap: DAILY_CAP,
  }
}
