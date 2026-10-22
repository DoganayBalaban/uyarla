import { redirect } from "next/navigation"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { FactsSection } from "@/features/account/components/FactsSection"
import { ResumeLibrary } from "@/features/resumes/components/ResumeLibrary"
import { loginPath } from "@/lib/returnPath"
import { getSession } from "@/server/authz"

export const metadata = { title: "CV'lerim · uyarla" }

/** CV kütüphanesi ve anlattığın deneyimler (DOG-149); Hesabım'dan ayrıldı. */
export default async function ResumesPage() {
  const session = await getSession()
  if (!session || session.user.isAnonymous) redirect(loginPath("/cvs"))
  return (
    <AppPage title="CV'lerim" description="Kayıtlı CV'lerin ve analizlerde kanıt saydığımız, senin anlattığın deneyimler.">
      <div className="space-y-8">
        <ResumeLibrary />
        <FactsSection />
      </div>
    </AppPage>
  )
}
