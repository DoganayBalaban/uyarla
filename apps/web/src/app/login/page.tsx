import { safeReturnPath } from "@/lib/returnPath"
import { enabledProviders } from "@/features/auth/providers"
import { GirisFormu } from "./GirisFormu"

// Hangi sosyal girişin açık olduğu ortam değişkenlerinden okunuyor; sayfa
// derleme anında sabitlenirse sonradan eklenen kimlik bilgisi görünmez.
export const dynamic = "force-dynamic"

export const metadata = { title: "Giriş yap · uyarla" }

export default async function GirisPage({
  searchParams,
}: {
  searchParams: Promise<{ donus?: string | string[] }>
}) {
  const { donus } = await searchParams
  // Dönüş adresi burada, sunucuda doğrulanıyor; forma yalnızca güvenli hâli
  // gidiyor (src/lib/returnPath.ts).
  return (
    <GirisFormu
      acikSaglayicilar={enabledProviders()}
      donus={safeReturnPath(Array.isArray(donus) ? donus[0] : donus)}
    />
  )
}
