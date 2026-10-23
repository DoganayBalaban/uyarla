import { redirect } from "next/navigation"
import { prisma } from "@uyarla/db"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { LinkedInAuditView } from "@/features/linkedin/components/LinkedInAuditView"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"
import { getProfile } from "@/server/profile"

export const metadata = { title: "LinkedIn profilin · uyarla" }

/** LinkedIn profil denetimi (DOG-157). Kayıtlı kullanıcıya açık. */
export default async function LinkedInPage() {
  const session = await getSession()
  if (!session || session.user.isAnonymous) redirect(loginPath("/linkedin"))
  const profile = await getProfile(prisma, session.user.id)
  return (
    <AppPage
      title="LinkedIn profilin"
      description="Profilini bölüm bölüm denetle: başlık, hakkında, deneyim, eğitim ve beceriler. Önerileri kopyalayıp LinkedIn'de sen uygularsın; profiline dokunmuyoruz."
    >
      <LinkedInAuditView initialTargetRole={profile?.targetRole ?? null} />
    </AppPage>
  )
}
