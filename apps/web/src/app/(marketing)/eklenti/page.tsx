import { ExtensionPage } from "@/features/landing/ExtensionPage"

export const metadata = {
  title: "Chrome eklentisi · uyarla",
  description: "İlan sayfasından tek tıkla uyarla'ya gönder: metin dolu gelir, skorun hesaplanır. Ücretsiz.",
}

/** Chrome eklentisinin tanıtım sayfası (DOG-163); kayıtlı kullanıcı da görebilir. */
export default function ExtensionRoute() {
  return <ExtensionPage />
}
