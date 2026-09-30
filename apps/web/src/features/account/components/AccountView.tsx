"use client"

import Link from "next/link"
import { useState } from "react"
import {
  CircleCheck,
  LayoutGrid,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react"
import { useSession } from "@/lib/authClient"
import { loginPath } from "@/lib/returnPath"
import { PageHeader } from "@/components/layout/PageShell"

/** Marka rehberi §10.2'deki veri silme onay metni, birebir. */
const CONFIRM_TEXT = "CV'ni ve tüm başvurularını kalıcı olarak silmek istediğine emin misin?"

export function AccountView() {
  const { data, isPending } = useSession()
  // "confirm" adımı ayrı: tek tıkla silinen bir hesap, geri alınamaz bir işlem
  // için fazla kolay. İkinci tık bilinçli bir karar oluyor.
  const [state, setState] = useState<"idle" | "confirm" | "deleting" | "deleted">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function deleteAccount() {
    setErrorMessage(null)
    setState("deleting")

    const response = await fetch("/api/account", { method: "DELETE" })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setErrorMessage(body?.error ?? "Hesabını silemedik. Birazdan tekrar dener misin?")
      setState("confirm")
      return
    }
    setState("deleted")
  }

  if (state === "deleted") {
    return (
      <div className="mx-auto max-w-md rounded-card border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-green/10 text-brand-green dark:text-[#4ade80]">
          <CircleCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl">Hesabın silindi</h1>
        <p className="mt-2 text-sm text-muted">
          CV&apos;n, ilanların ve analizlerin kalıcı olarak silindi. Bir gün
          yine iş arıyorsan buradayız.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-button bg-brand-blue px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-brand-blue/30"
        >
          Ana sayfaya dön
        </Link>
      </div>
    )
  }

  if (!isPending && !data?.user) {
    return (
      <div className="mx-auto max-w-md rounded-card border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-blue/10 text-brand-blue">
          <UserRound className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl">Hesabım</h1>
        <p className="mt-2 text-sm text-muted">Devam etmek için giriş yapman gerekiyor.</p>
        <Link
          href={loginPath("/account")}
          className="mt-6 inline-flex items-center gap-2 rounded-button bg-brand-blue px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-brand-blue/30"
        >
          Giriş yap
        </Link>
      </div>
    )
  }

  const currentUser = data?.user
  const registered = currentUser && !(currentUser as { isAnonymous?: boolean | null }).isAnonymous
  const initial = registered ? (currentUser.email[0] ?? "?").toLocaleUpperCase("tr-TR") : "?"

  return (
    <div className="max-w-2xl">
      <PageHeader title="Hesap ayarları" description="Hesabın, verilerin ve onları silme seçeneğin." />
      <div className="space-y-6">
        <div className="flex items-center gap-4 rounded-card border border-border bg-card p-6 shadow-sm">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8ea2ff] to-brand-blue font-heading text-xl font-extrabold text-white">
            {registered ? initial : <UserRound className="size-6" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="m-0 font-heading text-lg font-extrabold">Hesabım</p>
            {/* Anonim oturumun e-postası Better Auth'un ürettiği bir yer tutucu
                (…@anonymous.placeholder.invalid); göstermek kafa karıştırırdı. */}
            {registered ? (
              <p className="m-0 mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                {currentUser.email}
              </p>
            ) : (
              <p className="m-0 mt-0.5 text-sm text-muted">Kayıtsız oturum</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/applications"
            className="flex items-center gap-3 rounded-card border border-border bg-card p-4 text-sm no-underline transition hover:border-brand-blue/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-button bg-brand-blue/10 text-brand-blue">
              <LayoutGrid className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">Başvuru panosu</span>
              <span className="block text-muted">Analizlerin ve başvuruların</span>
            </span>
          </Link>
          <Link
            href="/privacy"
            className="flex items-center gap-3 rounded-card border border-border bg-card p-4 text-sm no-underline transition hover:border-brand-blue/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-button bg-brand-blue/10 text-brand-blue">
              <ShieldCheck className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-foreground">Verilerin</span>
              <span className="block text-muted">KVKK aydınlatma metni</span>
            </span>
          </Link>
        </div>

        <section className="rounded-card border border-brand-red/30 bg-card p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-button bg-brand-red/10 text-brand-red dark:text-[#f87171]">
              <Trash2 className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="m-0 text-lg">Verilerini sil</h2>
              <p className="m-0 mt-1 text-sm text-muted">
                CV&apos;n, yapıştırdığın ilanlar, analizlerin ve uyarlamaların
                silinir. Geri alınamaz.
              </p>
            </div>
          </div>

          {state === "idle" ? (
            <button
              type="button"
              className="mt-5 rounded-button border border-brand-red/60 px-5 py-2.5 text-sm font-semibold text-brand-red transition hover:bg-brand-red/5 dark:text-[#f87171]"
              onClick={() => setState("confirm")}
            >
              Hesabımı ve verilerimi sil
            </button>
          ) : (
            <div className="mt-5 rounded-button bg-brand-red/5 p-4">
              <p className="m-0 font-semibold">{CONFIRM_TEXT}</p>
              {errorMessage && (
                <p role="alert" className="mt-2 text-sm text-brand-red dark:text-[#f87171]">
                  {errorMessage}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={state === "deleting"}
                  className="inline-flex items-center gap-2 rounded-button bg-brand-red px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void deleteAccount()}
                >
                  {state === "deleting" && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
                  {state === "deleting" ? "Siliniyor…" : "Evet, kalıcı olarak sil"}
                </button>
                <button
                  type="button"
                  disabled={state === "deleting"}
                  className="rounded-button border border-border bg-card px-5 py-2.5 text-sm font-semibold"
                  onClick={() => {
                    setErrorMessage(null)
                    setState("idle")
                  }}
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
