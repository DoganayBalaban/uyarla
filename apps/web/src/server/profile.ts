import type { prisma } from "@uyarla/db"
import type { Goal, ProfilePatch } from "@/features/onboarding/schema"

type Db = typeof prisma

/**
 * Profil: ad, amaç, hedef rol ve onboarding durumu (DOG-50). Better Auth
 * oturumuna eklenmiyor; sunucu bileşenleri buradan tek sorguyla okuyor.
 */
export interface Profile {
  name: string
  email: string
  goal: Goal | null
  targetRole: string | null
  phone: string | null
  onboardedAt: Date | null
}

const PROFILE_SELECT = { name: true, email: true, goal: true, targetRole: true, phone: true, onboardedAt: true } as const

export function getProfile(db: Db, userId: string): Promise<Profile | null> {
  return db.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT })
}

export async function updateProfile(db: Db, userId: string, patch: ProfilePatch): Promise<Profile> {
  const current = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { onboardedAt: true } })
  return db.user.update({
    where: { id: userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.goal !== undefined ? { goal: patch.goal } : {}),
      ...(patch.targetRole !== undefined ? { targetRole: patch.targetRole } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      // İlk tamamlanma tarihi korunuyor: ikinci "Şimdilik geç" onu kaydırmasın.
      ...(patch.completeOnboarding && !current.onboardedAt ? { onboardedAt: new Date() } : {}),
    },
    select: PROFILE_SELECT,
  })
}
