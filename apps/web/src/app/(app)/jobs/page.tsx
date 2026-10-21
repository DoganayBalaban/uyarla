import { redirect } from "next/navigation"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { JobSearchCard } from "@/features/dashboard/components/JobSearchCard"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"
import { getSearchKeywords } from "@/server/dashboard"

export const metadata = { title: "İş ara · uyarla" }

/** İlan bul (DOG-68) kendi sayfasında (DOG-144). */
export default async function JobsPage() {
  const session = await getSession()
  if (!session || session.user.isAnonymous) redirect(loginPath("/jobs"))
  const keywords = await getSearchKeywords(session.user.id)
  return (
    <AppPage title="İş ara" description="Profilinden kurulan sorguyla iş sitelerinde ara." width="narrow">
      <JobSearchCard initialKeywords={keywords} />
    </AppPage>
  )
}
