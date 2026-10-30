import type { ProfileSnapshot } from "@uyarla/core/linkedin/snapshot"
import { MIN_JOB_TEXT_LENGTH } from "./posting.js"

/**
 * Sayfa düğmesinden ve simge menüsünden arka plana giden istekler (DOG-169).
 * Arka plan jeton üretip uyarla'yı açıyor; jetonlar yalnızca orada.
 */
export type ExtensionMessage =
  | { type: "uyarla-ilan"; text: string; url: string }
  | { type: "uyarla-profil"; snapshot: ProfileSnapshot }

interface Sender {
  id?: string
  tab?: { id?: number }
  url?: string
}

/**
 * Mesajı doğrular; eklentinin kendi betiklerinden gelmiyorsa ya da biçimi
 * bozuksa null. Kaynak: eklentinin kimliği ve ya bir sekmedeki içerik betiği
 * ya da simge menüsü. Profilin şeması arka planda ayrıca denetleniyor.
 */
export function readMessage(message: unknown, sender: Sender, self: { id: string; popupUrl: string }): ExtensionMessage | null {
  if (sender.id !== self.id) return null
  const fromTab = sender.tab?.id !== undefined
  const fromPopup = !fromTab && sender.url === self.popupUrl
  if (!fromTab && !fromPopup) return null
  const m = message as { type?: unknown; text?: unknown; url?: unknown; snapshot?: unknown } | null
  if (m?.type === "uyarla-ilan") {
    if (typeof m.text !== "string" || m.text.trim().length < MIN_JOB_TEXT_LENGTH || typeof m.url !== "string") return null
    return { type: "uyarla-ilan", text: m.text.trim(), url: m.url }
  }
  if (m?.type === "uyarla-profil") {
    if (!m.snapshot || typeof m.snapshot !== "object") return null
    return { type: "uyarla-profil", snapshot: m.snapshot as ProfileSnapshot }
  }
  return null
}
