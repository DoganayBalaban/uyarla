import type { z } from "zod"
import { api } from "@/lib/api"
import type { profilePatchSchema } from "@/features/onboarding/schema"

export type ProfilePatchInput = z.input<typeof profilePatchSchema>

export async function saveProfile(patch: ProfilePatchInput): Promise<void> {
  await api.patch("/profile", patch)
}

/** Kütüphaneye ekler; ilk CV olduğu için varsayılan oluyor (sunucu kuralı). */
export async function uploadLibraryResume(file: File, label: string): Promise<void> {
  const body = new FormData()
  body.append("cv", file)
  if (label.trim()) body.append("label", label)
  await api.post("/resumes", body)
}
