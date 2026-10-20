import { redirect } from "next/navigation"
import { PageShell } from "@/components/layout/PageShell"
import { LinkedInView } from "@/features/linkedin/components/LinkedInView"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"

export const metadata = { title: "LinkedIn profilin · uyarla" }

/** LinkedIn profil raporu (DOG-69). Kütüphane ve analizler kayıtlı kullanıcıda. */
export default async function LinkedInPage() {
  const session = await getSession()
  if (!session || session.user.isAnonymous) redirect(loginPath("/linkedin"))
  return (
    <PageShell width="narrow">
      <LinkedInView />
    </PageShell>
  )
}
