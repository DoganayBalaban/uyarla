import { prisma } from "@uyarla/db"
import { BOARD_SELECT, toBoardCard } from "@/features/applications/board"
import { type DashboardSummary, summarize } from "@/features/dashboard/summary"
import { GAP_WINDOW, skillGaps, type SkillGap } from "@/features/dashboard/skillGaps"

/**
 * Dashboard'un verisi: kullanıcının adı, tamamlanmış analizlerinin özeti ve
 * beceri açığı raporu (DOG-119). Başvuru panosuyla aynı seçimi kullanıyor
 * (BOARD_SELECT); açık raporu son analizlerin sonuçlarından.
 */
export async function getDashboardData(userId: string): Promise<{
  name: string | null
  targetRole: string | null
  summary: DashboardSummary
  gaps: { list: SkillGap[]; analyses: number }
}> {
  const [user, rows, recent, excluded] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, targetRole: true } }),
    prisma.analysis.findMany({
      where: { userId, status: "done" },
      orderBy: { createdAt: "desc" },
      select: BOARD_SELECT,
    }),
    prisma.analysis.findMany({
      where: { userId, status: "done" },
      orderBy: { createdAt: "desc" },
      take: GAP_WINDOW,
      select: { result: true },
    }),
    prisma.excludedConcept.findMany({ where: { userId }, select: { key: true } }),
  ])
  const report = skillGaps(
    recent.map((r) => r.result),
    excluded.map((e) => e.key),
  )
  return {
    name: user?.name ?? null,
    targetRole: user?.targetRole ?? null,
    summary: summarize(rows.map(toBoardCard)),
    gaps: { list: report.gaps, analyses: report.analyses },
  }
}
