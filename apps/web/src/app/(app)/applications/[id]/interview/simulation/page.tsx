import { AppPage } from "@/components/layout/app-shell/AppPage"
import { InterviewSimulation } from "@/features/applications/components/InterviewSimulation"

export const metadata = { title: "Mülakat simülasyonu · uyarla" }

/** Mülakat simülasyonu (DOG-172). Veri istemcide; sahiplik uçta kontrol ediliyor. */
export default async function InterviewSimulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AppPage width="narrow">
      <InterviewSimulation analysisId={id} />
    </AppPage>
  )
}
