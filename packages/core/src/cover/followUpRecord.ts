import { z } from "zod"
import { VerificationSchema } from "../schemas/adaptation.js"

/**
 * Takip mesajı ve teşekkür notu kaydı (DOG-117). Ayrı modül: pano ve kart
 * istemcide bunu okuyor; taslağı yazan `followUp.ts` ön yazı ve doğrulama
 * kodunu (eş anlamlı sözlüğü dahil) çekiyor ve istemciye gitmemeli.
 */
export type FollowUpKind = "followup" | "thanks" | "outreach"
export type FollowUpChannel = "email" | "linkedin"

/** Ağ kurma mesajında alıcı ve amaç (DOG-99). */
export type OutreachRecipient = "recruiter" | "team" | "contact"
export type OutreachPurpose = "introduce" | "ask" | "chat"
/** Kullanıcının verdiği bağlam ("aynı üniversiteden mezunuz") en çok bu kadar. */
export const OUTREACH_NOTE_MAX_LENGTH = 300

/** Bir başvuruda her türden en çok bu kadar taslak (ai-job-search: başvuru başına iki). */
export const MAX_FOLLOW_UPS_PER_KIND = 2

/** `Analysis.followUps` dizisinin bir öğesi. */
export const FollowUpRecordSchema = z.object({
  id: z.string(),
  kind: z.enum(["followup", "thanks", "outreach"]),
  channel: z.enum(["email", "linkedin"]),
  /** Yalnızca ağ kurma mesajında (DOG-99). */
  recipient: z.enum(["recruiter", "team", "contact"]).optional(),
  purpose: z.enum(["introduce", "ask", "chat"]).optional(),
  note: z.string().optional(),
  /** İstendiği anda başvuru yapılmış mıydı; değilse mesaj "başvurdum" demez. */
  applied: z.boolean().optional(),
  status: z.enum(["running", "done", "failed"]),
  subject: z.string().nullable().optional(),
  text: z.string().optional(),
  verification: VerificationSchema.optional(),
  createdAt: z.string(),
})
export type FollowUpRecord = z.infer<typeof FollowUpRecordSchema>

/**
 * Kayıttaki diziyi okur; dizi değilse boş dizi. Kayıtlar tek tek okunuyor:
 * tanınmayan bir kayıt (ör. yeni bir türü bilmeyen eski worker) yalnızca
 * kendisi atlanıyor. Bütün dizi reddedilseydi, okuyan kod diziyi geri
 * yazarken diğer taslakları silerdi (DOG-99).
 */
export function readFollowUps(value: unknown): FollowUpRecord[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const parsed = FollowUpRecordSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

