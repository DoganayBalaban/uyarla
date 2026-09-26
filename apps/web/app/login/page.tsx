import { acikSaglayicilar } from "@/lib/saglayicilar"
import { GirisFormu } from "./GirisFormu"

// Hangi sosyal girişin açık olduğu ortam değişkenlerinden okunuyor; sayfa
// derleme anında sabitlenirse sonradan eklenen kimlik bilgisi görünmez.
export const dynamic = "force-dynamic"

export const metadata = { title: "Giriş yap · uyarla" }

export default function GirisPage() {
  return <GirisFormu acikSaglayicilar={acikSaglayicilar()} />
}
