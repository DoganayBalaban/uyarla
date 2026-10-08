import { EMAIL, hasPhone } from "../format/check.js"

/**
 * İndirilen CV'nin iletişim satırı (DOG-58). CV'nin kendi satırında e-posta
 * ya da telefon yoksa hesaptaki bilgi ekleniyor; varsa dokunulmuyor (adayın
 * CV'de yazdığı öncelikli). Ayrıştırıcı başlık satırını gövdenin en
 * üstünden alıyor; e-posta üst bilgide ya da tabloda kaldıysa ATS onu
 * göremiyordu ve indirilen CV'de de çıkmıyordu.
 */
export function withContact(
  contact: string | null,
  account: { email?: string | null; phone?: string | null },
): string | null {
  const line = contact?.trim() ?? ""
  const parts = line ? [line] : []
  const email = account.email?.trim()
  const phone = account.phone?.trim()
  if (email && !EMAIL.test(line)) parts.push(email)
  if (phone && !hasPhone(line)) parts.push(phone)
  return parts.length ? parts.join(" · ") : null
}
