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
      <main>
        <h1>Posta kutunu kontrol et</h1>
        <p>
          <strong>{email}</strong> adresine bir giriş bağlantısı gönderdik.
          Bağlantı 15 dakika geçerli.
        </p>
        <p className="meta">
          Gelmediyse spam klasörüne bak, ya da{" "}
          <button className="btn-ikincil" onClick={() => setDurum("bos")}>
            tekrar dene
          </button>
        </p>
      </main>
    )
  }

  return (
    <main>
      <h1>Giriş yap</h1>
      <p className="meta">
        Parola yok. E-postanı bırak, sana bir giriş bağlantısı gönderelim.
      </p>

      <form onSubmit={gonder} style={{ marginTop: "1.5rem", maxWidth: "24rem" }}>
        <label htmlFor="email">E-posta</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="aday@ornek.com"
          style={{
            width: "100%",
            padding: "0.6rem",
            border: "1px solid var(--cizgi)",
            borderRadius: "var(--yaricap-buton)",
            background: "var(--kart)",
            color: "var(--metin)",
            font: "inherit",
          }}
        />
        {(hata ?? urlHatasi) && <p className="gerekce">{hata ?? urlHatasi}</p>}
        <p>
          <button className="btn-birincil" type="submit" disabled={durum === "gonderiliyor"}>
            {durum === "gonderiliyor" ? "Gönderiliyor…" : "Bağlantıyı gönder"}
          </button>
        </p>
      </form>

      <p className="meta">Kayıt gerekmez · CV&apos;n izinsiz paylaşılmaz</p>
    </main>
  )
}
