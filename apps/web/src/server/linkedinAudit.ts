import type { Prisma, prisma } from "@uyarla/db"
import type { LinkedInProfileData } from "@uyarla/core/linkedin/profileData"
import { KEEP_AUDITS, STUCK_MS } from "@/features/linkedin/audit"

type Db = typeof prisma

export class AuditBusyError extends Error {
  constructor(readonly auditId: string) {
    super("Taraman hâlâ sürüyor.")
    this.name = "AuditBusyError"
  }
}

/**
 * Yeni denetim kaydı (DOG-157, spec §4.1). Süren bir tarama varsa yenisi
 * açılmıyor (çift tıklama, iki sekme); 10 dakikadan eskisi takılmış sayılıyor.
 * Kayıt açılınca en yeni 5'in dışındakiler siliniyor.
 */
export async function createAudit(
  db: Db,
  userId: string,
  input: { source: "extension" | "pdf"; resumeId: string | null; profile: LinkedInProfileData | null; targetRole: string | null; analysisIds: string[] },
  now = new Date(),
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const running = await tx.linkedInAudit.findFirst({
      where: { userId, status: "running", createdAt: { gt: new Date(now.getTime() - STUCK_MS) } },
      select: { id: true },
    })
    if (running) throw new AuditBusyError(running.id)
    const created = await tx.linkedInAudit.create({
      data: {
        userId,
        source: input.source,
        resumeId: input.resumeId,
        profile: (input.profile ?? undefined) as Prisma.InputJsonValue | undefined,
        targetRole: input.targetRole,
        analysisIds: input.analysisIds,
        status: "running",
      },
      select: { id: true },
    })
    const old = await tx.linkedInAudit.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: KEEP_AUDITS, select: { id: true } })
    if (old.length > 0) await tx.linkedInAudit.deleteMany({ where: { id: { in: old.map((a) => a.id) } } })
    return created
  })
}
