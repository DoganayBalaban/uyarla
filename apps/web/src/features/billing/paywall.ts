/** Paket ekranı; ödemeden sonra kullanıcı `donus` adresine dönüyor (DOG-34). */
export function plansPath(returnTo: string): string {
  const internal = returnTo.startsWith("/") && !returnTo.startsWith("//")
  return internal ? `/plans?donus=${encodeURIComponent(returnTo)}` : "/plans"
}
