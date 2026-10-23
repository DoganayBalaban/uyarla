import type { LinkedInProfileData } from "@uyarla/core/linkedin/profileData"

/** Kendi profil sayfası: linkedin.com/in/<ad>; alt sayfalar ("details") değil (DOG-157). */
export function isProfileUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return /(^|\.)linkedin\.com$/.test(u.hostname) && /^\/in\/[^/]+\/?$/.test(u.pathname)
  } catch {
    return false
  }
}

/** UTF-8 JSON → URL'de güvenli base64 (Türkçe ve emoji bozulmasın). */
export function encodeProfile(profile: LinkedInProfileData): string {
  const bytes = new TextEncoder().encode(JSON.stringify(profile))
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Profil `#` kısmında: sunucuya ve istek günlüklerine gitmiyor (DOG-70 ile aynı). */
export function profileHandoffUrl(base: string, encoded: string, token: string): string {
  return `${base.replace(/\/+$/, "")}/linkedin#profil=${encoded}&jeton=${encodeURIComponent(token)}`
}
