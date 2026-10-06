"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { onboardingPath } from "@/features/onboarding/gate"

/**
 * Oturumu zaten açık olup onboarding'i görmemiş kullanıcıyı (DOG-50 öncesi
 * hesaplar) bir kez onboarding'e yollar; dönüş adresi bulunduğu sayfa.
 * Adres window'dan okunuyor: useSearchParams Suspense sınırı istiyor.
 */
export function OnboardingRedirect() {
  const router = useRouter()
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    router.replace(onboardingPath(window.location.pathname + window.location.search))
  }, [router])
  return null
}
