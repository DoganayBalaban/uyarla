import { notFound } from "next/navigation"
import { UiShowcase } from "@/components/ui-showcase/UiShowcase"

export const metadata = { title: "Bileşenler · uyarla" }

/**
 * Bileşen vitrini (DOG-143): shadcn bileşenleri marka temasıyla, açık ve
 * koyu. Yalnızca yerelde; üretimde 404.
 */
export default function UiPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <UiShowcase />
}
