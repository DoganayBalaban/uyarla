import { AdaptationView } from "@/features/adaptation/components/AdaptationView"

export default async function AdaptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AdaptationView id={id} />
}
