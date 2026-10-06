import type { Goal } from "@/features/onboarding/schema"

/** Onboarding ve hesabım sayfasındaki amaç seçenekleri. */
export const GOAL_OPTIONS: { value: Goal; label: string; hint: string }[] = [
  { value: "first_job", label: "İlk işimi arıyorum", hint: "Yeni mezun ya da staj sonrası" },
  { value: "career_change", label: "İş değiştiriyorum", hint: "Başka bir alana ya da şirkete geçiş" },
  { value: "promotion", label: "Bir üst pozisyon istiyorum", hint: "Aynı alanda daha kıdemli bir rol" },
  { value: "exploring", label: "Seçenekleri değerlendiriyorum", hint: "Acelem yok, bakınıyorum" },
]
