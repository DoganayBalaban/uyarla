/**
 * Navbar'da ve menüde gösterilecek ad (DOG-50). Ad yoksa (onboarding
 * atlandı) ya da sağlayıcı adı olarak e-postayı yazdıysa e-posta.
 */
export function displayName(user: { name: string | null | undefined; email: string }): string {
  const name = user.name?.trim()
  return name && !name.includes("@") ? name : user.email
}
