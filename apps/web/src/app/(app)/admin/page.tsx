import { prisma } from "@uyarla/db"
import { notFound } from "next/navigation"
import { PageHeader, PageShell } from "@/components/layout/PageShell"
import { FunnelReport } from "@/features/admin/components/FunnelReport"
import { getSession } from "@/server/authz"
import { computeFunnel, isAdmin } from "@/server/funnel"

export const metadata = { title: "Yönetim · uyarla", robots: { index: false } }
export const dynamic = "force-dynamic"

const DAY = 24 * 60 * 60 * 1000

/**
 * Huni raporu (DOG-62). Yalnızca `ADMIN_EMAILS`'teki hesaplar görüyor;
 * diğerleri için sayfa yokmuş gibi 404. Varlığını bile göstermemek, "yetkin
 * yok" demekten iyi.
 */
export default async function AdminPage() {
  const session = await getSession()
  const user = session
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, isAnonymous: true } })
    : null
  if (!isAdmin(user)) notFound()

  const now = new Date()
  const [week, month] = await Promise.all([
    computeFunnel(prisma, { from: new Date(now.getTime() - 7 * DAY), to: now }),
    computeFunnel(prisma, { from: new Date(now.getTime() - 30 * DAY), to: now }),
  ])

  return (
    <PageShell width="medium">
      <PageHeader title="Huni" description="Analizi tamamlayan kişilerin kayıt, uyarlama ve indirmeye geçişi." />
      <div className="space-y-6">
        <FunnelReport title="Son 7 gün" summary={week} />
        <FunnelReport title="Son 30 gün" summary={month} />
      </div>
    </PageShell>
  )
}
