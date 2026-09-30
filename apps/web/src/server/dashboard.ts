import { prisma } from "@uyarla/db"
import { BOARD_SELECT, toBoardCard } from "@/features/applications/board"
import { type DashboardSummary, summarize } from "@/features/dashboard/summary"

/**
 * Dashboard'un verisi: kullanıcının adı ve tamamlanmış analizlerinin özeti.
 * Başvuru panosuyla aynı seçimi kullanıyor (BOARD_SELECT).
 */
export async function getDashboardData(userId: string): Promise<{ name: string | null; summary: DashboardSummary }> {
  const [user, rows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.analysis.findMany({
      where: { userId, status: "done" },
      orderBy: { createdAt: "desc" },
      select: BOARD_SELECT,
    }),
  ])
  return { name: user?.name ?? null, summary: summarize(rows.map(toBoardCard)) }
}
