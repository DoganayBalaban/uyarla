/**
 * Yöneticiler: `ADMIN_EMAILS` listesindeki kayıtlı hesaplar. Yönetim sayfasını
 * görüyorlar ve uyarlama hakları sınırsız (ödeme duvarı ve günlük tavan
 * yok), ürünü canlıda paket almadan deneyebilsinler diye.
 *
 * Bağımlılıksız: uyarlama route'una eklenen her bağımlılık Vercel'in route
 * paketlemesini değiştirip Hobby'nin 12 fonksiyon sınırını aşabiliyor.
 */
export function isAdmin(
  user: { email?: string | null; isAnonymous?: boolean | null } | null | undefined,
  adminEmails: string | undefined = process.env.ADMIN_EMAILS,
): boolean {
  if (!user || user.isAnonymous === true || !user.email) return false
  const allowed = (adminEmails ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(user.email.trim().toLowerCase())
}
