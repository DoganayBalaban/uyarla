"use client"

import { useState } from "react"
import { useSession } from "@/lib/authClient"
import { girisAdresi } from "@/lib/donus"

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
      <main className="max-w-md">
        <h1 className="text-3xl">Hesabın silindi</h1>
        <p className="mt-3">
          CV&apos;n, ilanların ve analizlerin kalıcı olarak silindi. Bir gün
          yine iş arıyorsan buradayız.
        </p>
        <a
          href="/"
          className="mt-6 inline-block rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline"
        >
          Ana sayfaya dön
        </a>
      </main>
    )
  }

  if (!isPending && !data?.user) {
    return (
      <main className="max-w-md">
        <h1 className="text-3xl">Hesabım</h1>
        <p className="mt-3">Devam etmek için giriş yapman gerekiyor.</p>
        <a href={girisAdresi("/account")} className="mt-4 inline-block font-semibold text-mavi">
          Giriş yap
        </a>
      </main>
    )
  }

  const kullanici = data?.user
  const kayitli = kullanici && !(kullanici as { isAnonymous?: boolean | null }).isAnonymous

  return (
    <main className="max-w-md">
      <h1 className="text-3xl">Hesabım</h1>
      {/* Anonim oturumun e-postası Better Auth'un ürettiği bir yer tutucu
          (…@anonymous.placeholder.invalid); göstermek kafa karıştırırdı. */}
      {kayitli && <p className="mt-2 text-sm text-gri">{kullanici.email}</p>}

      <section className="mt-8 rounded-kart border border-cizgi bg-kart p-5">
        <h2 className="text-xl">Verilerini sil</h2>
        <p className="mt-2 text-sm text-gri">
          CV&apos;n, yapıştırdığın ilanlar, analizlerin ve uyarlamaların
          silinir. Geri alınamaz.
        </p>

        {durum === "bos" ? (
          <button
            className="mt-4 rounded-buton border border-kirmizi px-5 py-2.5 font-semibold text-kirmizi"
            onClick={() => setDurum("onay")}
          >
            Hesabımı ve verilerimi sil
          </button>
        ) : (
          <div className="mt-4">
            <p className="font-semibold">{ONAY_METNI}</p>
            {hata && <p className="mt-2 text-sm text-kehribar">{hata}</p>}
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                disabled={durum === "siliniyor"}
                className="rounded-buton bg-kirmizi px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => void sil()}
              >
                {durum === "siliniyor" ? "Siliniyor…" : "Evet, kalıcı olarak sil"}
              </button>
              <button
                disabled={durum === "siliniyor"}
                className="rounded-buton border border-cizgi px-5 py-2.5 font-semibold"
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
    </main>
  )
}
