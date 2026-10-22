import { notFound } from "next/navigation"
import { WaitingShowcase } from "@/components/ui-showcase/WaitingShowcase"

export const metadata = { title: "Bekleme ekranları · uyarla" }

/**
 * Analiz ve uyarlamanın bekleme ekranları, aşama seçilerek. Gerçek işte
 * karşılaştırma bir saniyeden kısa sürebiliyor; tasarımı burada görmek için.
 * Yalnızca yerelde; üretimde 404.
 */
export default function WaitingShowcasePage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <WaitingShowcase />
}
