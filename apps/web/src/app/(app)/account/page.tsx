import { AppPage } from "@/components/layout/app-shell/AppPage"
import { AccountView } from "@/features/account/components/AccountView"

export const metadata = { title: "Hesabım · uyarla" }

/** Hesabım (DOG-153): ayar düzeni; başlık oturuma göre, bileşen çiziyor. */
export default function AccountPage() {
  return (
    <AppPage>
      <AccountView />
    </AppPage>
  )
}
