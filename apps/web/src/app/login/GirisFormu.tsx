"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { signIn } from "@/lib/authClient"
import { epostaOnerisi, postaUygulamasi } from "@/lib/eposta"
import type { Saglayici } from "@/lib/saglayicilar"
import { GirisGorseli } from "./GirisGorseli"
import { SosyalGiris, girisHataAdresi } from "./SosyalGiris"

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
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 font-baslik text-xl font-extrabold tracking-tight text-metin"
    >
      {/* Rehber §9.1: üst üste iki belge, biri hafif eğik. */}
      <span aria-hidden="true" className="relative h-6 w-5">
        <span className="absolute inset-0 -translate-x-0.5 -rotate-12 rounded-[5px] bg-mavi/30" />
        <span className="absolute inset-0 rounded-[5px] bg-mavi" />
      </span>
      uyarla
    </Link>
  )
}

/**
 * Giriş ekranı. Parola yok: e-postaya giriş bağlantısı (magic link) ya da
 * Google/LinkedIn/GitHub. Aynı akış kayıt da yapıyor; ayrı bir "hesap
 * oluştur" ekranına gerek yok.
 */
export function GirisFormu({
  acikSaglayicilar,
  donus,
}: {
  acikSaglayicilar: Saglayici[]
  /** Girişten sonra gidilecek, doğrulanmış site içi adres. */
  donus: string
}) {
  const [email, setEmail] = useState("")
  const [durum, setDurum] = useState<"bos" | "gonderiliyor" | "gonderildi">("bos")
  const [hata, setHata] = useState<string | null>(null)
  const [kalan, setKalan] = useState(0)
  const [yenidenGonderildi, setYenidenGonderildi] = useState(false)

  // URL'deki hata yalnızca istemcide okunuyor; ilk çizimde okumak sunucu ile
  // istemci çıktısını ayrıştırıp hydration uyarısı veriyordu.
  useEffect(() => {
    setHata(hataMesaji(new URLSearchParams(window.location.search).get("error")))
  }, [])

  // Tekrar gönderme sayacı. 60 saniye, sunucudaki "dakikada 3 bağlantı"
  // sınırının (lib/auth.ts) içinde kalıyor: ilk gönderim + dakikada bir tekrar.
  useEffect(() => {
    if (kalan <= 0) return
    const id = setTimeout(() => setKalan((k) => k - 1), 1000)
    return () => clearTimeout(id)
  }, [kalan])

  const oneri = durum === "bos" ? epostaOnerisi(email) : null
  const uygulama = postaUygulamasi(email)

  /** Bağlantıyı gönderir; başarılıysa true. */
  async function baglantiGonder(): Promise<boolean> {
    const { error } = await signIn.magicLink({
      email,
      // Kullanıcı girişe bir işin ortasından geldiyse (ör. uyarlama) oraya
      // dönüyor; değilse ana akışa.
      callbackURL: donus,
      errorCallbackURL: girisHataAdresi(donus),
    })
    if (error) {
      setHata(
        error.status === 429
          ? "Çok sık denedin. Bir dakika sonra tekrar gönderebilirsin."
          : "Bağlantıyı gönderemedik. Birazdan tekrar dener misin?",
      )
      return false
    }
    setKalan(60)
    return true
  }

  async function gonder(event: React.FormEvent) {
    event.preventDefault()
    setHata(null)
    setDurum("gonderiliyor")
    const tamam = await baglantiGonder()
    setYenidenGonderildi(false)
    setDurum(tamam ? "gonderildi" : "bos")
  }

  async function tekrarGonder() {
    setHata(null)
    setYenidenGonderildi(false)
    if (await baglantiGonder()) setYenidenGonderildi(true)
  }

  return (
    <div className="flex min-h-dvh bg-white dark:bg-gece">
      <div className="flex w-full flex-col px-6 py-6 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">
        <header className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="text-sm font-medium text-gri transition-colors hover:text-metin">
            ← Ana sayfa
          </Link>
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

              <div className="mt-8 space-y-3">
                {uygulama && (
                  <a
                    href={uygulama.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-mavi px-5 py-4 font-semibold text-white shadow-[0_10px_24px_-10px_rgb(43_78_255/0.8)] transition hover:-translate-y-px hover:bg-[#2442e0]"
                  >
                    {uygulama.eylem}
                    <span aria-hidden="true">↗</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => void tekrarGonder()}
                  disabled={kalan > 0}
                  className="w-full rounded-2xl border border-cizgi px-5 py-3.5 font-semibold text-metin transition-colors hover:bg-zemin disabled:cursor-not-allowed disabled:text-gri disabled:hover:bg-transparent dark:hover:bg-white/5"
                >
                  {kalan > 0 ? (
                    <>
                      Tekrar gönder{" "}
                      <span className="tabular-nums">
                        ({Math.floor(kalan / 60)}:{String(kalan % 60).padStart(2, "0")})
                      </span>
                    </>
                  ) : (
                    "Bağlantıyı tekrar gönder"
                  )}
                </button>

                <p role="status" className="min-h-5 text-center text-sm">
                  {hata ? (
                    <span className="text-kehribar">{hata}</span>
                  ) : yenidenGonderildi ? (
                    <span className="text-yesil">Yeni bağlantı gönderildi. En son geleni kullan.</span>
                  ) : null}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setHata(null)
                  setDurum("bos")
                }}
                className="mt-2 w-full text-center text-sm font-medium text-gri underline-offset-4 hover:text-metin hover:underline"
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

                {oneri && (
                  <p className="mt-3 text-sm text-gri">
                    <button
                      type="button"
                      onClick={() => setEmail(oneri)}
                      className="font-semibold text-mavi underline-offset-4 hover:underline dark:text-[#8ea2ff]"
                    >
                      {oneri}
                    </button>{" "}
                    mı demek istedin?
                  </p>
                )}

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

              <div className="my-7 flex items-center gap-4 text-xs text-gri">
                <span className="h-px flex-1 bg-cizgi" />
                ya da şununla devam et
                <span className="h-px flex-1 bg-cizgi" />
              </div>

              <SosyalGiris acik={acikSaglayicilar} donus={donus} />

              <ul className="mt-9 space-y-2.5 text-sm text-gri">
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
          Devam ederek{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-metin">
            kullanım koşullarını
          </Link>{" "}
          kabul etmiş olursun. Verilerinin nasıl işlendiği{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-metin">
            KVKK aydınlatma metninde
          </Link>
          .
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
