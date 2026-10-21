import { redirect } from "next/navigation"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { InterviewList } from "@/features/applications/components/InterviewList"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"

export const metadata = { title: "Mülakatlar · uyarla" }

/** Mülakat aşamasındaki başvurular ve hazırlıkları (DOG-144). */
export default async function InterviewsPage() {
  const session = await getSession()
  if (!session || session.user.isAnonymous) redirect(loginPath("/interviews"))
  return (
    <AppPage title="Mülakatlar" description="Mülakat aşamasındaki başvuruların ve hazırlıkları.">
      <InterviewList />
    </AppPage>
  )
}
