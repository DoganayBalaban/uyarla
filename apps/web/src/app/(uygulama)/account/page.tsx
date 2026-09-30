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
import { SayfaBasligi } from "../../components/Sayfa"

/** Marka rehberi §10.2'deki veri silme onay metni, birebir. */
const ONAY_METNI = "CV'ni ve tüm başvurularını kalıcı olarak silmek istediğine emin misin?"

export default function HesapPage() {
  const { data, isPending } = useSession()
  // "onay" adımı ayrı: tek tıkla silinen bir hesap, geri alınamaz bir işlem
  // için fazla kolay. İkinci tık bilinçli bir karar oluyor.
  const [durum, setDurum] = useState<"bos" | "onay" | "siliniyor" | "silindi">("bos")
  const [hata, setHata] = useState<string | null>(null)

  async function sil() {
    setHata(null)
    setDurum("siliniyor")

    const cevap = await fetch("/api/account", { method: "DELETE" })
    if (!cevap.ok) {
      const govde = (await cevap.json().catch(() => null)) as { error?: string } | null
      setHata(govde?.error ?? "Hesabını silemedik. Birazdan tekrar dener misin?")
      setDurum("onay")
      return
    }
    setDurum("silindi")
  }

  if (durum === "silindi") {
    return (
      <div className="mx-auto max-w-md rounded-kart border border-cizgi bg-kart p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-yesil/10 text-yesil dark:text-[#4ade80]">
          <CircleCheck className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl">Hesabın silindi</h1>
        <p className="mt-2 text-sm text-gri">
          CV&apos;n, ilanların ve analizlerin kalıcı olarak silindi. Bir gün
          yine iş arıyorsan buradayız.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-mavi/30"
        >
          Ana sayfaya dön
        </Link>
      </div>
    )
  }

  if (!isPending && !data?.user) {
    return (
      <div className="mx-auto max-w-md rounded-kart border border-cizgi bg-kart p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-mavi/10 text-mavi">
          <UserRound className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl">Hesabım</h1>
        <p className="mt-2 text-sm text-gri">Devam etmek için giriş yapman gerekiyor.</p>
        <Link
          href={loginPath("/account")}
          className="mt-6 inline-flex items-center gap-2 rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-mavi/30"
        >
          Giriş yap
        </Link>
      </div>
    )
  }

  const kullanici = data?.user
  const kayitli = kullanici && !(kullanici as { isAnonymous?: boolean | null }).isAnonymous
  const basHarf = kayitli ? (kullanici.email[0] ?? "?").toLocaleUpperCase("tr-TR") : "?"

  return (
    <div className="max-w-2xl">
      <SayfaBasligi baslik="Hesap ayarları" aciklama="Hesabın, verilerin ve onları silme seçeneğin." />
      <div className="space-y-6">
        <div className="flex items-center gap-4 rounded-kart border border-cizgi bg-kart p-6 shadow-sm">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8ea2ff] to-mavi font-baslik text-xl font-extrabold text-white">
            {kayitli ? basHarf : <UserRound className="size-6" aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="m-0 font-baslik text-lg font-extrabold">Hesabım</p>
            {/* Anonim oturumun e-postası Better Auth'un ürettiği bir yer tutucu
                (…@anonymous.placeholder.invalid); göstermek kafa karıştırırdı. */}
            {kayitli ? (
              <p className="m-0 mt-0.5 flex items-center gap-1.5 truncate text-sm text-gri">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                {kullanici.email}
              </p>
            ) : (
              <p className="m-0 mt-0.5 text-sm text-gri">Kayıtsız oturum</p>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/applications"
            className="flex items-center gap-3 rounded-kart border border-cizgi bg-kart p-4 text-sm no-underline transition hover:border-mavi/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-buton bg-mavi/10 text-mavi">
              <LayoutGrid className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-metin">Başvuru panosu</span>
              <span className="block text-gri">Analizlerin ve başvuruların</span>
            </span>
          </Link>
          <Link
            href="/privacy"
            className="flex items-center gap-3 rounded-kart border border-cizgi bg-kart p-4 text-sm no-underline transition hover:border-mavi/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-buton bg-mavi/10 text-mavi">
              <ShieldCheck className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-metin">Verilerin</span>
              <span className="block text-gri">KVKK aydınlatma metni</span>
            </span>
          </Link>
        </div>

        <section className="rounded-kart border border-kirmizi/30 bg-kart p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-buton bg-kirmizi/10 text-kirmizi dark:text-[#f87171]">
              <Trash2 className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="m-0 text-lg">Verilerini sil</h2>
              <p className="m-0 mt-1 text-sm text-gri">
                CV&apos;n, yapıştırdığın ilanlar, analizlerin ve uyarlamaların
                silinir. Geri alınamaz.
              </p>
            </div>
          </div>

          {durum === "bos" ? (
            <button
              type="button"
              className="mt-5 rounded-buton border border-kirmizi/60 px-5 py-2.5 text-sm font-semibold text-kirmizi transition hover:bg-kirmizi/5 dark:text-[#f87171]"
              onClick={() => setDurum("onay")}
            >
              Hesabımı ve verilerimi sil
            </button>
          ) : (
            <div className="mt-5 rounded-buton bg-kirmizi/5 p-4">
              <p className="m-0 font-semibold">{ONAY_METNI}</p>
              {hata && (
                <p role="alert" className="mt-2 text-sm text-kirmizi dark:text-[#f87171]">
                  {hata}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={durum === "siliniyor"}
                  className="inline-flex items-center gap-2 rounded-buton bg-kirmizi px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void sil()}
                >
                  {durum === "siliniyor" && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
                  {durum === "siliniyor" ? "Siliniyor…" : "Evet, kalıcı olarak sil"}
                </button>
                <button
                  type="button"
                  disabled={durum === "siliniyor"}
                  className="rounded-buton border border-cizgi bg-kart px-5 py-2.5 text-sm font-semibold"
                  onClick={() => {
                    setHata(null)
                    setDurum("bos")
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
