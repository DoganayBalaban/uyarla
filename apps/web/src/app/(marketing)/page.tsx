import { redirect } from "next/navigation"
import { LandingPage } from "@/features/landing/LandingPage"
import { getSession } from "@/server/authz"

export default async function HomePage() {
  // Tanıtım ziyaretçiler için. Kayıtlı kullanıcı doğrudan uygulamanın ana
  // ekranına gider; anonim oturum (kayıtsız analiz yapmış ziyaretçi) burada
  // kalır, çünkü ona henüz anlatılacak şey var.
  const session = await getSession()
  if (session && !session.user.isAnonymous) redirect("/dashboard")
  return <LandingPage />
}
