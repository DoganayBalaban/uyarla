import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { plansFromEnv } from "@/features/billing/plans"
import { LandingPage } from "@/features/landing/LandingPage"
import { getSession } from "@/server/authz"

/**
 * TikTok profilinin bağlantısı (DOG-162): ana sayfanın aynısı, ayrı yolda.
 * Web Analytics'te `/t` ziyaretleri TikTok'tan geleni sayıyor; uygulama içi
 * tarayıcı yönlendiren siteyi her zaman bildirmiyor. Arama motorlarına
 * kapalı, kanonik adres ana sayfa.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
  alternates: { canonical: "/" },
}

export default async function TikTokLandingPage() {
  const session = await getSession()
  if (session && !session.user.isAnonymous) redirect("/dashboard")
  return <LandingPage plans={plansFromEnv(process.env)} />
}
