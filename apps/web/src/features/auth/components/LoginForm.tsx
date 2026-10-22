"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "@/lib/authClient"
import { suggestEmail, mailAppFor } from "@/features/auth/emailHints"
import type { Provider } from "@/features/auth/providers"
import { loginSchema, type LoginFormValues } from "@/features/auth/schema"
import { LoginVisual } from "@/features/auth/components/LoginVisual"
import { Logo } from "@/components/layout/Logo"
import { ArrowRight, Check, LoaderCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { onboardingPath } from "@/features/onboarding/gate"
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
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  })
  const email = watch("email")
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
  async function sendLink(address: string): Promise<boolean> {
    const { error } = await signIn.magicLink({
      email: address,
      // Kullanıcı girişe bir işin ortasından geldiyse (ör. uyarlama) oraya
      // dönüyor; değilse ana akışa. Önce onboarding kapısı: bitirmiş
      // kullanıcıyı sunucu anında hedefe yolluyor.
      callbackURL: onboardingPath(returnTo),
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

  async function submit(values: LoginFormValues) {
    setLoginError(null)
    setState("sending")
    // Şema adresi kırpıyor; gönderilen ve ekranda gösterilen adres aynı olsun.
    setValue("email", values.email)
    const done = await sendLink(values.email)
    setResent(false)
    setState(done ? "sent" : "idle")
  }

  async function resend() {
    setLoginError(null)
    setResent(false)
    if (await sendLink(email)) setResent(true)
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <div className="flex w-full flex-col px-6 py-6 sm:px-10 lg:w-1/2 lg:px-16 xl:px-24">
        <header className="flex items-center justify-between">
          <Logo />
          <Link href="/" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            ← Ana sayfa
          </Link>
        </header>

        <main className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          {state === "sent" ? (
            <div>
              <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Mail className="size-7" strokeWidth={1.75} aria-hidden />
              </span>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                Posta kutunu kontrol et
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                <strong className="font-semibold text-foreground">{email}</strong> adresine bir giriş
                bağlantısı gönderdik. Bağlantı 15 dakika geçerli.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Gelmediyse spam klasörüne bak.</p>

              <div className="mt-8 space-y-3">
                {mailApp && (
                  <Button asChild size="lg" className="h-12 w-full text-base">
                    <a href={mailApp.url} target="_blank" rel="noopener noreferrer">
                      {mailApp.action}
                      <span aria-hidden="true">↗</span>
                    </a>
                  </Button>
                )}

                <Button type="button" variant="outline" size="lg" className="h-12 w-full text-base" onClick={() => void resend()} disabled={remaining > 0}>
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
                </Button>

                <p role="status" className="min-h-5 text-center text-sm">
                  {loginError ? (
                    <span className="text-brand-amber">{loginError}</span>
                  ) : resent ? (
                    <span className="text-brand-green">Yeni bağlantı gönderildi. En son geleni kullan.</span>
                  ) : null}
                </p>
              </div>

              <Button
                type="button"
                variant="link"
                className="mt-2 w-full text-muted-foreground"
                onClick={() => {
                  setLoginError(null)
                  setState("idle")
                }}
              >
                Başka bir e-posta kullan
              </Button>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Hoş geldin
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                E-postanı bırak, sana bir giriş bağlantısı gönderelim. Hesabın yoksa bu adımla
                oluşur.
              </p>

              <form onSubmit={handleSubmit(submit)} noValidate className="mt-10">
                <Label htmlFor="email" className="mb-2">
                  E-posta adresi
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  {...register("email")}
                  placeholder="aday@ornek.com"
                  aria-invalid={loginError || errors.email ? true : undefined}
                  aria-describedby={loginError || errors.email ? "giris-hata" : undefined}
                  className="h-12 px-4 text-base"
                />

                {suggestion && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => setValue("email", suggestion, { shouldValidate: !!errors.email })}
                      className="font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {suggestion}
                    </button>{" "}
                    mı demek istedin?
                  </p>
                )}

                {(errors.email || loginError) && (
                  <p id="giris-hata" role="alert" className="mt-3 text-sm text-brand-amber">
                    {errors.email?.message ?? loginError}
                  </p>
                )}

                <Button type="submit" size="lg" disabled={state === "sending"} className="group mt-6 h-12 w-full text-base">
                  {state === "sending" ? (
                    <>
                      <LoaderCircle className="motion-safe:animate-spin" aria-hidden />
                      Gönderiliyor…
                    </>
                  ) : (
                    <>
                      Giriş bağlantısı gönder
                      <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </>
                  )}
                </Button>
              </form>

              <div className="my-7 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ya da şununla devam et
                <span className="h-px flex-1 bg-border" />
              </div>

              <SocialLogin open={enabledProviders} returnTo={returnTo} />

              <ul className="mt-9 space-y-2.5 text-sm text-muted-foreground">
                {[
                  "Skorunu görmek için hesap gerekmez",
                  "CV'n satılmaz, model eğitiminde kullanılmaz",
                  "Yaptığın analizler hesabına taşınır",
                ].map((m) => (
                  <li key={m} className="flex items-center gap-2.5">
                    <Check className="size-4 shrink-0 text-brand-green" aria-hidden />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>

        <footer className="text-xs text-muted-foreground">
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
