/**
 * Komut menüsünde son açılanlar (DOG-154). Yalnızca tarayıcıda; sunucuya
 * gitmiyor. Aynı adres bir kez, en yeni önde.
 */
export interface RecentItem {
  href: string
  label: string
}

export const RECENT_KEY = "uyarla:son-acilanlar"
export const RECENT_MAX = 5

export function pushRecent(list: RecentItem[], item: RecentItem, max = RECENT_MAX): RecentItem[] {
  return [item, ...list.filter((r) => r.href !== item.href)].slice(0, max)
}

/** Bozuk ya da eski biçimli kaydı yok sayar. */
export function parseRecent(raw: string | null): RecentItem[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value
      .filter((r): r is RecentItem => !!r && typeof r.href === "string" && r.href.startsWith("/") && typeof r.label === "string")
      .slice(0, RECENT_MAX)
  } catch {
    return []
  }
}
