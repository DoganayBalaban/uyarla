import { AppPage } from "@/components/layout/app-shell/AppPage"
import { ApplicationBoard } from "@/features/applications/components/ApplicationBoard"

export const metadata = { title: "Başvurular · uyarla" }

/** Başvurular (DOG-148): pano ya da tablo. Başlık veriye bağlı, bileşen çiziyor. */
export default function ApplicationsPage() {
  return (
    <AppPage className="max-w-[90rem]">
      <ApplicationBoard />
    </AppPage>
  )
}
