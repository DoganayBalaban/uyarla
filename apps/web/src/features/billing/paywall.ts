import { DEFAULT_RETURN_PATH, safeReturnPath } from "@/lib/returnPath"

/**
 * Ödemeden sonra dönülecek iç adres; güvenli değilse null (DOG-34).
 * Kontrol giriş akışındaki `safeReturnPath`'te: "/\evil.com", kontrol
 * karakterleri ve köken değişimi orada engelleniyor. Kendi `startsWith("/")`
 * kontrolümüz "/\evil.com"u geçiriyordu (son gözden geçirme).
 */
export function safePlansReturn(raw: string | null | undefined): string | null {
  if (!raw) return null
  const safe = safeReturnPath(raw)
  return safe === DEFAULT_RETURN_PATH && raw !== DEFAULT_RETURN_PATH ? null : safe
}

/** Paket ekranı; ödemeden sonra kullanıcı `donus` adresine dönüyor (DOG-34). */
export function plansPath(returnTo: string): string {
  const safe = safePlansReturn(returnTo)
  return safe ? `/plans?donus=${encodeURIComponent(safe)}` : "/plans"
}
