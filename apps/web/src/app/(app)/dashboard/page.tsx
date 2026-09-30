import { redirect } from "next/navigation"
import { DashboardView } from "@/features/dashboard/components/DashboardView"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"
import { getDashboardData } from "@/server/dashboard"

export const metadata = { title: "Genel bakış · uyarla" }

/**
 * Kayıtlı kullanıcının ana ekranı. Tanıtım sayfası kayıtlı kullanıcıyı buraya
 * yönlendiriyor; logo da buraya götürüyor.
 */
export default async function DashboardPage() {
  const session = await getSession()
  // Anonim oturumun panosu yok; işleri kayıt olunca hesaba taşınıyor.
  if (!session || session.user.isAnonymous) redirect(loginPath("/dashboard"))
  const { name, summary } = await getDashboardData(session.user.id)
  return <DashboardView name={name} summary={summary} />
}
