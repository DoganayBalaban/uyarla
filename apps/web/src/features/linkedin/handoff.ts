import { LinkedInProfileDataSchema, type LinkedInProfileData } from "@uyarla/core/linkedin/profileData"
import type { SendMessage } from "@/features/analysis/extensionHandoff"
import { MAX_AUDIT_POSTINGS } from "@/features/linkedin/audit"

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

type PostingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

const POSTINGS_KEY = "uyarla:linkedin-ilanlar"
const POSTINGS_TTL_MS = 60 * 60_000

/** Tarayıcının localStorage'ı; gizli pencerede ya da engelliyse null. */
export function browserStorage(): PostingStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Eklenti yolunda seçilen ilanlar (son inceleme): kullanıcı ilanları seçip
 * LinkedIn'i açıyor, eklenti profili yeni bir sekmede /linkedin'e getiriyor.
 * Seçim o sekmeye bir saatliğine buradan taşınıyor; boş seçim siliniyor.
 */
export function rememberPostings(storage: PostingStorage | null, ids: string[], now: Date): void {
  try {
    if (ids.length === 0) storage?.removeItem(POSTINGS_KEY)
    else storage?.setItem(POSTINGS_KEY, JSON.stringify({ ids, at: now.getTime() }))
  } catch {
    // Depolama kapalıysa eklenti taraması ilansız başlıyor.
  }
}

/** Aktarımda bir kez okunuyor ve siliniyor; eski ya da bozuk seçim yok sayılıyor. */
export function takePostings(storage: PostingStorage | null, now: Date): string[] {
  try {
    const raw = storage?.getItem(POSTINGS_KEY)
    storage?.removeItem(POSTINGS_KEY)
    const saved = raw ? (JSON.parse(raw) as { ids?: unknown; at?: unknown }) : null
    if (!saved || typeof saved.at !== "number" || now.getTime() - saved.at > POSTINGS_TTL_MS || !Array.isArray(saved.ids)) return []
    return saved.ids.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, MAX_AUDIT_POSTINGS)
  } catch {
    return []
  }
}
