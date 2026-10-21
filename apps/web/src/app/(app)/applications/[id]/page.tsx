import { AppPage } from "@/components/layout/app-shell/AppPage"
import { ApplicationDetail } from "@/features/applications/components/ApplicationDetail"

export const metadata = { title: "Başvuru · uyarla" }

/** Başvuru detayı (DOG-138). Veri istemcide; sahiplik uçta kontrol ediliyor. */
export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AppPage width="narrow">
      <ApplicationDetail analysisId={id} />
    </AppPage>
  )
}
