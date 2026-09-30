import { PageShell } from "@/components/layout/PageShell"
import { ApplicationBoard as ApplicationBoard } from "@/features/applications/components/ApplicationBoard"

export const metadata = { title: "Başvuru panosu · uyarla" }

/** Başvuru panosu. Beş sütun orta genişliğe sığmıyor; geniş kapta çiziliyor. */
export default function ApplicationsPage() {
  return (
    <PageShell width="wide">
      <ApplicationBoard />
    </PageShell>
  )
}
