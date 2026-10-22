import { AppPage } from "@/components/layout/app-shell/AppPage"
import { StartGuide } from "@/features/guide/components/StartGuide"

export const metadata = {
  title: "Nereden başlamalıyım? · uyarla",
  description: "Dört kısa soruyla iş aramanda ilk adımın: CV analizi, ilan bulma, LinkedIn ya da mülakat hazırlığı.",
}

/** Kararsız ilk ziyaret için yönlendirme (DOG-101); kayıt istemiyor. */
export default function StartGuidePage() {
  return (
    <AppPage
      width="narrow"
      title="Nereden başlamalıyım?"
      description="Dört kısa soru, tek bir ilk adım. Cevapların hiçbir yere kaydedilmiyor."
    >
      <StartGuide />
    </AppPage>
  )
}
