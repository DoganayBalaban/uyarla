import { notFound } from "next/navigation"
import { LinkedInShowcase } from "@/components/ui-showcase/LinkedInShowcase"

export const metadata = { title: "LinkedIn denetimi · uyarla" }

/** LinkedIn denetiminin hâlleri: başlangıç, sonuç (kilitli ve açık). Yalnızca yerelde. */
export default function LinkedInShowcasePage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <LinkedInShowcase />
}
