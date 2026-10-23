import { LinkedInProfileDataSchema, type LinkedInProfileData } from "@uyarla/core/linkedin/profileData"
import type { SendMessage } from "@/features/analysis/extensionHandoff"

/**
 * Eklentinin `/linkedin#profil=…&jeton=…` aktarımı (DOG-157, spec §5.2).
 * Profil yoksa null; bozuksa hata (sayfa "PDF ile dene" diyor).
 */
export function readProfileHandoff(hash: string): { profile: LinkedInProfileData; token: string } | { error: "invalid" } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""))
  const encoded = params.get("profil")
  if (!encoded) return null
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))
    const json = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
    const parsed = LinkedInProfileDataSchema.safeParse(JSON.parse(json))
    const token = params.get("jeton")
    return parsed.success && token ? { profile: parsed.data, token } : { error: "invalid" }
  } catch {
    return { error: "invalid" }
  }
}

/** Eklenti kurulu mu: yapılandırılmış kimliklerden biri yoklamaya cevap verirse. */
export async function detectExtension(ids: string[], send: SendMessage | undefined, timeoutMs = 1200): Promise<boolean> {
  if (!send || ids.length === 0) return false
  const asks = ids.map(
    (id) =>
      new Promise<boolean>((resolve) => {
        send(id, { type: "uyarla-ping" }, (response) => resolve((response as { ok?: unknown } | undefined)?.ok === true))
      }),
  )
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs))
  // İlk olumlu cevap yeter; cevap vermeyen bir kimlik (geliştirme ya da mağaza) beklenmiyor.
  const anyYes = new Promise<boolean>((resolve) => {
    let left = asks.length
    for (const ask of asks)
      void ask.then((yes) => {
        left--
        if (yes) resolve(true)
        else if (left === 0) resolve(false)
      })
  })
  return Promise.race([anyYes, timeout])
}

/** Chrome Web Mağazası sayfası; eklenti yayımlanınca ortamdan geliyor. */
export const EXTENSION_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || null
