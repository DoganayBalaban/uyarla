import { OturumCubugu } from "../components/OturumCubugu"
import { Pano } from "./Pano"

export const metadata = { title: "Başvuru panosu · uyarla" }

/**
 * Başvuru panosu. Beş sütun uygulama grubunun genişliğine sığmıyor; aynı
 * çerçeve daha geniş bir kapla çiziliyor.
 */
export default function ApplicationsPage() {
  return (
    <div className="relative min-h-dvh bg-zemin">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgb(43_78_255/0.08),transparent)]"
      />
      <OturumCubugu genis />
      <main className="relative mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6 sm:pt-10">
        <Pano />
      </main>
    </div>
  )
}
