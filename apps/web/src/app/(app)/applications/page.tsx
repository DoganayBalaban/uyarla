import { SayfaKabi } from "@/components/layout/PageShell"
import { Pano } from "@/features/applications/components/ApplicationBoard"

export const metadata = { title: "Başvuru panosu · uyarla" }

/** Başvuru panosu. Beş sütun orta genişliğe sığmıyor; geniş kapta çiziliyor. */
export default function ApplicationsPage() {
  return (
    <SayfaKabi genislik="genis">
      <Pano />
    </SayfaKabi>
  )
}
