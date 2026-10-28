import { notFound } from "next/navigation"
import { SceneShowcase } from "@/components/ui-showcase/SceneShowcase"

export const metadata = { title: "Tanıtım sahneleri · uyarla" }

/** Tanıtım sahneleri kare kare (DOG-160). Yalnızca yerelde; üretimde 404. */
export default function LandingScenesPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <SceneShowcase />
}
