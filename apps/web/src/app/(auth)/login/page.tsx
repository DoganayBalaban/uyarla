import { returnPathFromSearchParams } from "@/lib/returnPath"
import { enabledProviders } from "@/features/auth/providers"
import { LoginForm } from "@/features/auth/components/LoginForm"

// Hangi sosyal girişin açık olduğu ortam değişkenlerinden okunuyor; sayfa
// derleme anında sabitlenirse sonradan eklenen kimlik bilgisi görünmez.
export const dynamic = "force-dynamic"

export const metadata = { title: "Giriş yap · uyarla" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ donus?: string | string[] }>
}) {
  // Dönüş adresi burada, sunucuda doğrulanıyor; forma yalnızca güvenli hâli
  // gidiyor (src/lib/returnPath.ts).
  return (
    <LoginForm
      enabledProviders={enabledProviders()}
      returnTo={returnPathFromSearchParams(await searchParams)}
    />
  )
}
