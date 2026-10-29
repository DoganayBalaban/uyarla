import { notFound } from "next/navigation"
import { ReelShowcase } from "@/components/ui-showcase/ReelShowcase"

export const metadata = { title: "Dikey videolar · uyarla" }

/** TikTok deneyinin dikey videoları (DOG-162). Yalnızca yerelde; üretimde 404. */
export default async function ReelsPage({ searchParams }: { searchParams: Promise<{ n?: string; capture?: string; body?: string; end?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { n, capture, body, end } = await searchParams
  const timing = body && end ? { body: Number(body), end: Number(end) } : undefined
  return <ReelShowcase n={n ? Number(n) : null} capture={capture === "1"} timing={timing} />
}
