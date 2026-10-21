import type { Verification } from "../schemas/adaptation.js"

/**
 * "Aktarılabilir deneyim" kaydı (DOG-100); `Analysis.transferable`. Tarayıcı
 * da okuyor, bu yüzden üretim kodundan (`transferable.ts`) ayrı.
 */

/** İstek üzerine yazılıyor; ikinci deneme bir kez. */
export const MAX_TRANSFERABLE_ATTEMPTS = 2

export interface TransferableItem {
  /** Analizdeki gereksinimin sırası (`requirements`). */
  requirementIndex: number
  requirement: string
  /** CV'deki madde, birebir; aktarılabilir deneyim yoksa null. */
  quote: string | null
  /** Bu deneyimin gereksinime nasıl aktarılacağı, tek cümle. */
  reason: string | null
  /** Gerekçede CV'de olmayan sayı varsa işaretli. */
  verification: Verification | null
}

export type TransferableRecord =
  | { status: "running"; createdAt: string; attempts: number }
  | { status: "failed"; createdAt: string; attempts: number }
  | { status: "done"; createdAt: string; attempts: number; items: TransferableItem[] }

/** Okuma toleranslı: tanınmayan kayıt yok sayılıyor. */
export function readTransferable(value: unknown): TransferableRecord | null {
  if (!value || typeof value !== "object") return null
  const v = value as { status?: unknown; createdAt?: unknown; attempts?: unknown; items?: unknown }
  if (typeof v.createdAt !== "string" || typeof v.attempts !== "number") return null
  if (v.status === "running" || v.status === "failed") return { status: v.status, createdAt: v.createdAt, attempts: v.attempts }
  if (v.status === "done" && Array.isArray(v.items)) {
    return { status: "done", createdAt: v.createdAt, attempts: v.attempts, items: v.items as TransferableItem[] }
  }
  return null
}
