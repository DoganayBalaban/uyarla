import Link from "next/link"
import { ArrowRight, Compass, Info } from "lucide-react"
import { AppPage } from "@/components/layout/app-shell/AppPage"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { ScoreResult } from "@/features/analysis/components/ScoreResult"
import { SAMPLE_REPORT, SAMPLE_REPORT_POSTING } from "@/features/analysis/sampleReport"

export const metadata = {
  title: "Örnek rapor · uyarla",
  description: "Kurgusal bir CV'nin kurgusal bir ilanla analizi: uyum skoru, eksik anahtar kelimeler ve biçim kontrolü.",
}

/**
 * Örnek rapor (DOG-101): CV yüklemeden önce ne alacağını görmek isteyen
 * ziyaretçi için. Salt okunur; işaretleme ve uyarlama düğmeleri yok.
 */
export default function SampleReportPage() {
  return (
    <AppPage
      title="Örnek rapor"
      description="Kendi CV'nle analiz ettiğinde alacağın rapor bu. Gerçek çıktı, kurgusal veriyle."
      actions={
        <Button asChild>
          <Link href="/analyze">
            Kendi CV&apos;nle dene
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      }
    >
      <Alert className="mb-6 border-primary/30 bg-primary/5">
        <Info className="text-primary" aria-hidden />
        <AlertTitle>Kurgusal bir pazarlama CV&apos;si, örnek bir ilanla</AlertTitle>
        <AlertDescription>
          <p className="m-0">
            Kişi, şirketler ve ilan uydurma; rapor uyarla&apos;nın gerçek çıktısı. Kendi analizinde gereksinimleri
            işaretleyebilir, eksikleri düzeltebilir ve CV&apos;ni bu ilana uyarlayabilirsin.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/nereden-baslamali">
                <Compass aria-hidden />
                Nereden başlamalıyım?
              </Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
      <ScoreResult result={SAMPLE_REPORT} postingText={SAMPLE_REPORT_POSTING.text} adapting={false} />
    </AppPage>
  )
}
