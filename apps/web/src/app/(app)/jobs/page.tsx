import { redirect } from "next/navigation"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { JobSearch } from "@/features/jobs/components/JobSearch"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"
import { getJobSearchData } from "@/server/dashboard"

export const metadata = { title: "İş ara · uyarla" }

/** İş ara (DOG-150): profilden kurulan sorguyla iş sitelerinin arama sayfaları. */
export default async function JobsPage() {
  const session = await getSession()
  if (!session || session.user.isAnonymous) redirect(loginPath("/jobs"))
  const { keywords, roles, skills, gaps } = await getJobSearchData(session.user.id)
  return (
    <AppPage title="İş ara" description="Profilinden kurulan sorguyla iş sitelerinde ara; beğendiğin ilanı getir, uyumunu ölç.">
      <JobSearch initialKeywords={keywords} roles={roles} skills={skills} gaps={gaps} />
    </AppPage>
  )
}
