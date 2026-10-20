import { z } from "zod"
import { VerificationSchema } from "../schemas/adaptation.js"

/**
 * Takip mesajı ve teşekkür notu kaydı (DOG-117). Ayrı modül: pano ve kart
 * istemcide bunu okuyor; taslağı yazan `followUp.ts` ön yazı ve doğrulama
 * kodunu (eş anlamlı sözlüğü dahil) çekiyor ve istemciye gitmemeli.
 */
export type FollowUpKind = "followup" | "thanks"
export type FollowUpChannel = "email" | "linkedin"

/** Bir başvuruda her türden en çok bu kadar taslak (ai-job-search: başvuru başına iki). */
export const MAX_FOLLOW_UPS_PER_KIND = 2

/** `Analysis.followUps` dizisinin bir öğesi. */
export const FollowUpRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(["followup", "thanks"]),
  channel: z.enum(["email", "linkedin"]),
  status: z.enum(["running", "done", "failed"]),
  subject: z.string().nullable().optional(),
  text: z.string().optional(),
  verification: VerificationSchema.optional(),
  createdAt: z.string(),
})
export type FollowUpRecord = z.infer<typeof FollowUpRecordSchema>

/** Kayıttaki diziyi okur; bozuk ya da boşsa boş dizi. */
export function readFollowUps(value: unknown): FollowUpRecord[] {
  const parsed = z.array(FollowUpRecordSchema).safeParse(value ?? [])
  return parsed.success ? parsed.data : []
}

