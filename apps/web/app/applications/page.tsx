import { OturumCubugu } from "../components/OturumCubugu"
import { Pano } from "./Pano"

export const metadata = { title: "Başvuru panosu · uyarla" }

/**
 * Başvuru panosu. Uygulama grubunun dar sütunu beş sütunlu panoya yetmiyor;
 * aynı oturum çubuğuyla daha geniş bir kapta çiziliyor.
 */
export default function ApplicationsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 pb-16 sm:px-6">
      <OturumCubugu />
      <Pano />
    </div>
  )
}
