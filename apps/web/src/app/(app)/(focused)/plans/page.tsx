import { PlansView } from "@/features/billing/components/PlansView"
import { plansFromEnv } from "@/features/billing/plans"

export const metadata = { title: "Paketler · uyarla" }
export const dynamic = "force-dynamic"

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ donus?: string }> }) {
  const { donus } = await searchParams
  const returnTo = donus && donus.startsWith("/") && !donus.startsWith("//") ? donus : null
  return <PlansView plans={plansFromEnv(process.env)} returnTo={returnTo} />
}
