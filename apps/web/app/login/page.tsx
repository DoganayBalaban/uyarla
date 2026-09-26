"use client"

import { useEffect, useState } from "react"
import { signIn } from "@/lib/authClient"
import { GirisGorseli } from "./GirisGorseli"

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

function Logo() {
  return (
    <a
      href="/"
      className="inline-flex items-center gap-2.5 font-baslik text-xl font-extrabold tracking-tight text-metin"
    >
      {/* Rehber §9.1: üst üste iki belge, biri hafif eğik. */}
      <span aria-hidden="true" className="relative h-6 w-5">
        <span className="absolute inset-0 -translate-x-0.5 -rotate-12 rounded-[5px] bg-mavi/30" />
        <span className="absolute inset-0 rounded-[5px] bg-mavi" />
      </span>
      uyarla
    </a>
  )
}

/**
 * Giriş ekranı. Parola yok, Google yok: yalnızca e-postaya giriş bağlantısı
 * (magic link). Aynı akış kayıt da yapıyor; ayrı bir "hesap oluştur"
 * ekranına gerek yok.
 */
export default function GirisPage() {
  const [email, setEmail] = useState("")
  const [durum, setDurum] = useState<"bos" | "gonderiliyor" | "gonderildi">("bos")
  const [hata, setHata] = useState<string | null>(null)

  // URL'deki hata yalnızca istemcide okunuyor; ilk çizimde okumak sunucu ile
  // istemci çıktısını ayrıştırıp hydration uyarısı veriyordu.
  useEffect(() => {
    setHata(hataMesaji(new URLSearchParams(window.location.search).get("error")))
  }, [])

  async function gonder(event: React.FormEvent) {
    event.preventDefault()
    setHata(null)
    setDurum("gonderiliyor")

    const { error } = await signIn.magicLink({
      email,
      // Giriş sonrası kullanıcıyı ana akışa alıyoruz; dönüş adresi takibi
      // Sprint 3B'nin işi.
      callbackURL: "/analyze",
    })

    if (error) {
      setHata("Bağlantıyı gönderemedik. Birazdan tekrar dener misin?")
      setDurum("bos")
      return
    }
    setDurum("gonderildi")
  }

  return (
    <div className="flex min-h-dvh bg-white dark:bg-gece">
      <div className="flex w-full flex-col px-6 py-6 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">
        <header className="flex items-center justify-between">
          <Logo />
          <a href="/" className="text-sm font-medium text-gri transition-colors hover:text-metin">
            ← Ana sayfa
          </a>
        </header>

        <main className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          {durum === "gonderildi" ? (
            <div>
              <span className="grid size-14 place-items-center rounded-2xl bg-mavi/10 text-mavi dark:text-[#8ea2ff]">
                <svg
                  viewBox="0 0 24 24"
                  className="size-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <h1 className="mt-6 font-baslik text-4xl font-extrabold tracking-tight sm:text-5xl">
                Posta kutunu kontrol et
              </h1>
              <p className="mt-4 text-base leading-relaxed text-gri">
                <strong className="font-semibold text-metin">{email}</strong> adresine bir giriş
                bağlantısı gönderdik. Bağlantı 15 dakika geçerli.
              </p>
              <p className="mt-2 text-sm text-gri">Gelmediyse spam klasörüne bak.</p>

              <button
                type="button"
                onClick={() => setDurum("bos")}
                className="mt-8 w-full rounded-buton border border-cizgi px-5 py-3.5 font-semibold text-metin transition-colors hover:bg-zemin dark:hover:bg-white/5"
              >
                Başka bir e-posta kullan
              </button>
            </div>
          ) : (
            <div>
              <h1 className="font-baslik text-4xl font-extrabold tracking-tight sm:text-5xl">
                Hoş geldin
              </h1>
              <p className="mt-4 text-base leading-relaxed text-gri">
                E-postanı bırak, sana bir giriş bağlantısı gönderelim. Hesabın yoksa bu adımla
                oluşur.
              </p>

              <form onSubmit={gonder} className="mt-10">
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-metin">
                  E-posta adresi
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aday@ornek.com"
                  aria-invalid={hata ? true : undefined}
                  aria-describedby={hata ? "giris-hata" : undefined}
                  className="w-full rounded-2xl border border-transparent bg-zemin px-5 py-4 dark:bg-white/5 text-base text-metin outline-none ring-mavi/25 transition placeholder:text-gri/80 focus:border-mavi focus:bg-white focus:ring-4 dark:focus:bg-white/10"
                />

                {hata && (
                  <p id="giris-hata" role="alert" className="mt-3 text-sm text-kehribar">
                    {hata}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={durum === "gonderiliyor"}
                  className="group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-mavi px-5 py-4 font-semibold text-white shadow-[0_10px_24px_-10px_rgb(43_78_255/0.8)] transition hover:-translate-y-px hover:bg-[#2442e0] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {durum === "gonderiliyor" ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Gönderiliyor…
                    </>
                  ) : (
                    <>
                      Giriş bağlantısı gönder
                      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                        →
                      </span>
                    </>
                  )}
                </button>
              </form>

              <div className="my-8 flex items-center gap-4 text-xs text-gri">
                <span className="h-px flex-1 border-t border-dashed border-cizgi" />
                parola yok, hatırlaman gereken bir şey yok
                <span className="h-px flex-1 border-t border-dashed border-cizgi" />
              </div>

              <ul className="space-y-2.5 text-sm text-gri">
                {[
                  "Skorunu görmek için hesap gerekmez",
                  "CV'n izinsiz kimseyle paylaşılmaz",
                  "Yaptığın analizler hesabına taşınır",
                ].map((m) => (
                  <li key={m} className="flex items-center gap-2.5">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-4 shrink-0 text-yesil"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>

        <footer className="text-xs text-gri">
          © 2026 uyarla · Her ilana, doğru CV.
        </footer>
      </div>

      <div className="hidden p-4 lg:block lg:w-1/2">
        <div className="sticky top-4 h-[calc(100dvh-2rem)]">
          <GirisGorseli />
        </div>
      </div>
    </div>
  )
}
