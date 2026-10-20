import { MAX_FOLLOW_UPS_PER_KIND, readFollowUps, type FollowUpChannel, type FollowUpKind, type FollowUpRecord } from "@uyarla/core/cover/followUpRecord"

export type FollowUpError = "too_many" | "already_running"

export const FOLLOW_UP_ERROR_MESSAGE: Record<FollowUpError, string> = {
  too_many: `Bu başvuru için en fazla ${MAX_FOLLOW_UPS_PER_KIND} taslak yazabiliyoruz; sonuncusunu düzenleyip kullanabilirsin.`,
  already_running: "Bu başvuru için taslak hâlâ yazılıyor.",
}

/**
 * Yeni taslak isteğini mevcut diziye ekler (DOG-117). Saf: kilit ve kayıt
 * route'ta. Her türden en çok iki taslak; aynı tür yazılırken ikincisi yok.
 */
export function addFollowUp(
  current: unknown,
  input: {
    kind: FollowUpKind
    channel: FollowUpChannel
    recipient?: FollowUpRecord["recipient"]
    purpose?: FollowUpRecord["purpose"]
    note?: string
    /** Ağ kurma mesajında: istek anında başvuru yapılmış mı (aşama "saved" değil). */
    applied?: boolean
  },
  id: string,
  now: Date,
): { list: FollowUpRecord[]; record: FollowUpRecord } | { error: FollowUpError } {
  const list = readFollowUps(current)
  const sameKind = list.filter((f) => f.kind === input.kind && f.status !== "failed")
  if (sameKind.some((f) => f.status === "running")) return { error: "already_running" }
  if (sameKind.length >= MAX_FOLLOW_UPS_PER_KIND) return { error: "too_many" }
  const { recipient, purpose, note, applied, ...base } = input
  const extra =
    input.kind === "outreach"
      ? { recipient: recipient ?? "recruiter", purpose: purpose ?? "introduce", applied: applied ?? false, ...(note ? { note } : {}) }
      : {}
  const record: FollowUpRecord = { id, ...base, ...extra, status: "running", createdAt: now.toISOString() }
  // Ham diziye ekleniyor: bu sürümün tanımadığı kayıtlar silinmesin.
  return { list: [...(Array.isArray(current) ? (current as FollowUpRecord[]) : []), record], record }
}
