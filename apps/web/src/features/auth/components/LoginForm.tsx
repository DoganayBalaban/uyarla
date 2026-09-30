"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { signIn } from "@/lib/authClient"
import { suggestEmail, mailAppFor } from "@/features/auth/emailHints"
import type { Provider } from "@/features/auth/providers"
import { LoginVisual } from "@/features/auth/components/LoginVisual"
import { SocialLogin, girisHataAdresi } from "@/features/auth/components/SocialLogin"

/**
 * Better Auth'un hata kodlarını Türkçe mesaja çeviriyor.
 *
 * Bilinmeyen kod için genel mesaj: kullanıcıya İngilizce bir hata kodu
 * göstermenin hiçbir faydası yok.
 */
function errorMessage(errorCode: string | null): string | null {
  if (!errorCode) return null
  if (/EXPIRED|INVALID/i.test(errorCode)) {
    return "Bu bağlantının süresi dolmuş. Yenisini gönderelim mi?"
  }
  return "Giriş yapılamadı. E-postanı tekrar girer misin?"
}

function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 font-heading text-xl font-extrabold tracking-tight text-foreground"
    >
      {/* Rehber §9.1: üst üste iki belge, biri hafif eğik. */}
      <span aria-hidden="true" className="relative h-6 w-5">
        <span className="absolute inset-0 -translate-x-0.5 -rotate-12 rounded-[5px] bg-brand-blue/30" />
        <span className="absolute inset-0 rounded-[5px] bg-brand-blue" />
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
export function LoginForm({
  enabledProviders,
  returnTo,
}: {
  enabledProviders: Provider[]
  /** Girişten sonra gidilecek, doğrulanmış site içi adres. */
  returnTo: string
}) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle")
  const [loginError, setLoginError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [resent, setResent] = useState(false)

  // URL'deki hata yalnızca istemcide okunuyor; ilk çizimde okumak sunucu ile
  // istemci çıktısını ayrıştırıp hydration uyarısı veriyordu.
  useEffect(() => {
    setLoginError(errorMessage(new URLSearchParams(window.location.search).get("error")))
  }, [])

  // Tekrar gönderme sayacı. 60 saniye, sunucudaki "dakikada 3 bağlantı"
  // sınırının (src/server/auth.ts) içinde kalıyor: ilk gönderim + dakikada bir tekrar.
  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining((k) => k - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  const suggestion = state === "idle" ? suggestEmail(email) : null
  const mailApp = mailAppFor(email)

  /** Bağlantıyı gönderir; başarılıysa true. */
  async function sendLink(): Promise<boolean> {
    const { error } = await signIn.magicLink({
      email,
      // Kullanıcı girişe bir işin ortasından geldiyse (ör. uyarlama) oraya
      // dönüyor; değilse ana akışa.
      callbackURL: returnTo,
      errorCallbackURL: girisHataAdresi(returnTo),
    })
    if (error) {
      setLoginError(
        error.status === 429
          ? "Çok sık denedin. Bir dakika sonra tekrar gönderebilirsin."
          : "Bağlantıyı gönderemedik. Birazdan tekrar dener misin?",
      )
      return false
    }
    setRemaining(60)
    return true
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoginError(null)
    setState("sending")
    const done = await sendLink()
    setResent(false)
    setState(done ? "sent" : "idle")
  }

  async function resend() {
    setLoginError(null)
    setResent(false)
    if (await sendLink()) setResent(true)
  }

  return (
    <div className="flex min-h-dvh bg-white dark:bg-brand-night">
      <div className="flex w-full flex-col px-6 py-6 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">
        <header className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="text-sm font-medium text-muted transition-colors hover:text-foreground">
            ← Ana sayfa
          </Link>
        </header>

        <main className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          {state === "sent" ? (
            <div>
              <span className="grid size-14 place-items-center rounded-2xl bg-brand-blue/10 text-brand-blue dark:text-[#8ea2ff]">
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
              <h1 className="mt-6 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
                Posta kutunu kontrol et
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted">
                <strong className="font-semibold text-foreground">{email}</strong> adresine bir giriş
                bağlantısı gönderdik. Bağlantı 15 dakika geçerli.
              </p>
              <p className="mt-2 text-sm text-muted">Gelmediyse spam klasörüne bak.</p>

              <div className="mt-8 space-y-3">
                {mailApp && (
                  <a
                    href={mailApp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue px-5 py-4 font-semibold text-white shadow-[0_10px_24px_-10px_rgb(43_78_255/0.8)] transition hover:-translate-y-px hover:bg-[#2442e0]"
                  >
                    {mailApp.action}
                    <span aria-hidden="true">↗</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => void resend()}
                  disabled={remaining > 0}
                  className="w-full rounded-2xl border border-border px-5 py-3.5 font-semibold text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent dark:hover:bg-white/5"
                >
                  {remaining > 0 ? (
                    <>
                      Tekrar gönder{" "}
                      <span className="tabular-nums">
                        ({Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")})
                      </span>
                    </>
                  ) : (
                    "Bağlantıyı tekrar gönder"
                  )}
                </button>

                <p role="status" className="min-h-5 text-center text-sm">
                  {loginError ? (
                    <span className="text-brand-amber">{loginError}</span>
                  ) : resent ? (
                    <span className="text-brand-green">Yeni bağlantı gönderildi. En son geleni kullan.</span>
                  ) : null}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLoginError(null)
                  setState("idle")
                }}
                className="mt-2 w-full text-center text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                Başka bir e-posta kullan
              </button>
            </div>
          ) : (
            <div>
              <h1 className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
                Hoş geldin
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted">
                E-postanı bırak, sana bir giriş bağlantısı gönderelim. Hesabın yoksa bu adımla
                oluşur.
              </p>

              <form onSubmit={submit} className="mt-10">
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
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
                  aria-invalid={loginError ? true : undefined}
                  aria-describedby={loginError ? "giris-hata" : undefined}
                  className="w-full rounded-2xl border border-transparent bg-background px-5 py-4 dark:bg-white/5 text-base text-foreground outline-none ring-brand-blue/25 transition placeholder:text-muted/80 focus:border-brand-blue focus:bg-white focus:ring-4 dark:focus:bg-white/10"
                />

                {suggestion && (
                  <p className="mt-3 text-sm text-muted">
                    <button
                      type="button"
                      onClick={() => setEmail(suggestion)}
                      className="font-semibold text-brand-blue underline-offset-4 hover:underline dark:text-[#8ea2ff]"
                    >
                      {suggestion}
                    </button>{" "}
                    mı demek istedin?
                  </p>
                )}

                {loginError && (
                  <p id="giris-hata" role="alert" className="mt-3 text-sm text-brand-amber">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={state === "sending"}
                  className="group mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue px-5 py-4 font-semibold text-white shadow-[0_10px_24px_-10px_rgb(43_78_255/0.8)] transition hover:-translate-y-px hover:bg-[#2442e0] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {state === "sending" ? (
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

              <div className="my-7 flex items-center gap-4 text-xs text-muted">
                <span className="h-px flex-1 bg-border" />
                ya da şununla devam et
                <span className="h-px flex-1 bg-border" />
              </div>

              <SocialLogin open={enabledProviders} returnTo={returnTo} />

              <ul className="mt-9 space-y-2.5 text-sm text-muted">
                {[
                  "Skorunu görmek için hesap gerekmez",
                  "CV'n izinsiz kimseyle paylaşılmaz",
                  "Yaptığın analizler hesabına taşınır",
                ].map((m) => (
                  <li key={m} className="flex items-center gap-2.5">
                    <svg
                      viewBox="0 0 24 24"
                      className="size-4 shrink-0 text-brand-green"
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

        <footer className="text-xs text-muted">
          Devam ederek{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            kullanım koşullarını
          </Link>{" "}
          kabul etmiş olursun. Verilerinin nasıl işlendiği{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            KVKK aydınlatma metninde
          </Link>
          .
        </footer>
      </div>

      <div className="hidden p-4 lg:block lg:w-1/2">
        <div className="sticky top-4 h-[calc(100dvh-2rem)]">
          <LoginVisual />
        </div>
      </div>
    </div>
  )
}
