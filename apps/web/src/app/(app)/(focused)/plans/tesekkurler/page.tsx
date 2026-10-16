import { ThanksView } from "@/features/billing/components/ThanksView"

export const metadata = { title: "Teşekkürler · uyarla" }

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ donus?: string }> }) {
  const { donus } = await searchParams
  const returnTo = donus && donus.startsWith("/") && !donus.startsWith("//") ? donus : null
  return <ThanksView returnTo={returnTo} />
}
