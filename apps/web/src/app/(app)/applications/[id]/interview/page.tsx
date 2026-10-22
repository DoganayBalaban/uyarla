import { AppPage } from "@/components/layout/app-shell/AppPage"
import { InterviewPrepView } from "@/features/applications/components/InterviewPrepView"

export const metadata = { title: "Mülakat hazırlığı · uyarla" }

/** Mülakat hazırlık paketi (DOG-118). Veri istemcide; sahiplik uçta kontrol ediliyor. */
export default async function InterviewPrepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AppPage width="narrow">
      <InterviewPrepView analysisId={id} />
    </AppPage>
  )
}
