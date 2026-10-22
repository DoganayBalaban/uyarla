import { redirect } from "next/navigation"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { LinkedInView } from "@/features/linkedin/components/LinkedInView"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"

export const metadata = { title: "LinkedIn profilin · uyarla" }

/** LinkedIn profil raporu (DOG-69). Kütüphane ve analizler kayıtlı kullanıcıda. */
export default async function LinkedInPage() {
  const session = await getSession()
  if (!session || session.user.isAnonymous) redirect(loginPath("/linkedin"))
  return (
    <AppPage
      title="LinkedIn profilin"
      description="Profilini hedeflediğin ilanlarla karşılaştır: eksik kalan beceriler, başlık ve “Hakkında” önerileri. Profiline dokunmuyoruz; önerileri LinkedIn'de sen uygularsın."
      width="narrow"
    >
      <LinkedInView />
    </AppPage>
  )
}
