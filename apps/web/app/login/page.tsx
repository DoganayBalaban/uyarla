"use client"

import { useState } from "react"
import { signIn } from "@/lib/authClient"

/**
 * Better Auth'un hata kodlarını Türkçe mesaja çeviriyor.
 *
 * Bilinmeyen kod için genel mesaj: kullanıcıya İngilizce bir hata kodu
 * göstermenin hiçbir faydası yok.
 */
function hataMesaji(kod: string | null): string | null {
  if (!kod) return null
  if (/EXPIRED|INVALID/i.test(kod)) {
    return "Bu bağlantının süresi dolmuş. Yenisini gönderelim mi?"
  }
  return "Giriş yapılamadı. E-postanı tekrar girer misin?"
}

export default function GirisPage() {
  const [email, setEmail] = useState("")
  const [durum, setDurum] = useState<"bos" | "gonderiliyor" | "gonderildi">("bos")
  const [hata, setHata] = useState<string | null>(null)
  const [urlHatasi] = useState(() =>
    typeof window === "undefined"
      ? null
      : hataMesaji(new URLSearchParams(window.location.search).get("error")),
  )

  async function gonder(event: React.FormEvent) {
    event.preventDefault()
    setHata(null)
    setDurum("gonderiliyor")

    const { error } = await signIn.magicLink({
      email,
      // Giriş sonrası kullanıcıyı ana akışa alıyoruz; dönüş adresi takibi
      // Sprint 3B'nin işi.
      callbackURL: "/test",
    })

    if (error) {
      setHata("Bağlantıyı gönderemedik. Birazdan tekrar dener misin?")
      setDurum("bos")
      return
    }
    setDurum("gonderildi")
  }

  if (durum === "gonderildi") {
    return (
      <main className="max-w-md">
        <h1 className="text-3xl">Posta kutunu kontrol et</h1>
        <p className="mt-3">
          <strong>{email}</strong> adresine bir giriş bağlantısı gönderdik.
          Bağlantı 15 dakika geçerli.
        </p>
        <p className="mt-4 text-sm text-gri dark:text-gri-koyu">
          Gelmediyse spam klasörüne bak, ya da{" "}
          <button
            className="rounded-buton border border-cizgi px-3 py-1.5 font-semibold dark:border-cizgi-koyu"
            onClick={() => setDurum("bos")}
          >
            tekrar dene
          </button>
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-md">
      <h1 className="text-3xl">Giriş yap</h1>
      <p className="mt-2 text-sm text-gri dark:text-gri-koyu">
        Parola yok. E-postanı bırak, sana bir giriş bağlantısı gönderelim.
      </p>

      <form onSubmit={gonder} className="mt-6 space-y-3">
        <div>
          <label htmlFor="email" className="mb-1 block font-semibold">
            E-posta
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="aday@ornek.com"
            className="w-full rounded-buton border border-cizgi bg-white p-2.5 font-govde dark:border-cizgi-koyu dark:bg-kart-koyu"
          />
        </div>
        {(hata ?? urlHatasi) && <p className="text-sm text-kehribar">{hata ?? urlHatasi}</p>}
        <button
          type="submit"
          disabled={durum === "gonderiliyor"}
          className="rounded-buton bg-mavi px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {durum === "gonderiliyor" ? "Gönderiliyor…" : "Bağlantıyı gönder"}
        </button>
      </form>

      <p className="mt-6 text-sm text-gri dark:text-gri-koyu">
        Kayıt gerekmez · CV&apos;n izinsiz paylaşılmaz
      </p>
    </main>
  )
}
