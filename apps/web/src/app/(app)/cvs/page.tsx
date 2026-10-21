import { redirect } from "next/navigation"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { FactsSection } from "@/features/account/components/FactsSection"
import { ResumeLibrarySection } from "@/features/account/components/ResumeLibrarySection"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"

export const metadata = { title: "CV'lerim · uyarla" }

/** CV kütüphanesi ve doğrulanmış bilgiler (DOG-144); hesap ayarlarından ayrıldı. */
export default async function ResumesPage() {
  const session = await getSession()
  if (!session || session.user.isAnonymous) redirect(loginPath("/cvs"))
  return (
    <AppPage title="CV'lerim" description="Kayıtlı CV'lerin ve analizlerde kullandığımız bilgiler." width="narrow">
      <div className="space-y-6">
        <ResumeLibrarySection />
        <FactsSection />
      </div>
    </AppPage>
  )
}
