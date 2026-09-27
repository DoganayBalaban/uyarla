"use client"

import { useEffect, useState } from "react"
import {
  ASAMALAR,
  ASAMA_ETIKETI,
  NOT_UZUNLUGU,
  sutunlaraDagit,
  type Asama,
  type PanoKarti,
} from "@/lib/pano"

type Yukleme =
  | { durum: "yukleniyor" }
  | { durum: "giris" }
  | { durum: "hata"; mesaj: string }
  | { durum: "hazir"; kartlar: PanoKarti[] }

/** Skor yalnızca renkle değil etiketle de (rehber §9.2). */
function skorEtiketi(skor: number): { metin: string; sinif: string } {
  // Koyu temada durum renklerinin açık tonları: AA kontrastı için.
  if (skor >= 70) return { metin: "Yüksek", sinif: "bg-yesil/10 text-yesil dark:text-[#4ade80]" }
  if (skor >= 40) return { metin: "Orta", sinif: "bg-kehribar/15 text-kehribar" }
  return { metin: "Düşük", sinif: "bg-kirmizi/10 text-kirmizi dark:bg-kirmizi/20 dark:text-[#f87171]" }
}

const TARIH = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" })

/** Sütun başlığının altındaki kısa metin; rehber §6.2 tonunda. */
const SUTUN_ALTI: Partial<Record<Asama, string>> = {
  saved: "Skorunu aldın, henüz başvurmadın.",
  rejected: "Bu olmadı, olur.",
  offer: "Tebrikler!",
}

export function Pano() {
  const [yukleme, setYukleme] = useState<Yukleme>({ durum: "yukleniyor" })

  useEffect(() => {
    void (async () => {
      const cevap = await fetch("/api/applications")
      if (cevap.status === 401) return setYukleme({ durum: "giris" })
      if (!cevap.ok) {
        return setYukleme({ durum: "hata", mesaj: "Panonu yükleyemedik. Sayfayı yenileyip tekrar dener misin?" })
      }
      const { kartlar } = (await cevap.json()) as { kartlar: PanoKarti[] }
      setYukleme({ durum: "hazir", kartlar })
    })()
  }, [])

  /** İyimser güncelleme: kart hemen yer değiştiriyor, hata olursa geri alınıyor. */
  async function guncelle(analysisId: string, degisiklik: { asama?: Asama; not?: string }) {
    if (yukleme.durum !== "hazir") return
    const onceki = yukleme.kartlar
    setYukleme({
      durum: "hazir",
      kartlar: onceki.map((k) =>
        k.analysisId === analysisId
          ? {
              ...k,
              ...(degisiklik.asama && { asama: degisiklik.asama, asamaTarihi: new Date().toISOString() }),
              ...(degisiklik.not !== undefined && { not: degisiklik.not || null }),
            }
          : k,
      ),
    })
    const cevap = await fetch(`/api/applications/${analysisId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(degisiklik),
    })
    if (!cevap.ok) setYukleme({ durum: "hazir", kartlar: onceki })
  }

  if (yukleme.durum === "yukleniyor") return <p className="text-sm text-gri">Panon yükleniyor…</p>
  if (yukleme.durum === "hata") return <p className="text-kehribar">{yukleme.mesaj}</p>
  if (yukleme.durum === "giris") {
    return (
      <main className="max-w-md py-10">
        <h1 className="text-3xl">Başvuru panon</h1>
        <p className="mt-3 text-gri">
          Hangi ilana hangi CV ile başvurduğunu görmek için giriş yap. Kayıtsız yaptığın
          analizler hesabına taşınır.
        </p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline"
        >
          Giriş yap
        </a>
      </main>
    )
  }

  const { kartlar } = yukleme
  const sutunlar = sutunlaraDagit(kartlar)
  const basvurulan = kartlar.filter((k) => k.asama !== "saved").length
  const mulakat = sutunlar.interview.length + sutunlar.offer.length

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-3xl">Başvuru panon</h1>
          <p className="mt-2 text-sm text-gri">
            {kartlar.length === 0
              ? "Her analiz buraya bir kart olarak düşer."
              : `${kartlar.length} ilan · ${basvurulan} başvuru · ${mulakat} mülakat`}
          </p>
        </div>
        <a
          href="/analyze"
          className="rounded-buton bg-mavi px-5 py-2.5 font-semibold text-white no-underline"
        >
          Yeni analiz
        </a>
      </div>

      {kartlar.length === 0 ? (
        <div className="mt-10 rounded-kart border border-dashed border-cizgi p-10 text-center">
          {/* Rehber §10.2: boş pano metni, birebir. */}
          <p className="m-0 font-baslik text-xl font-extrabold">Henüz başvuru yok.</p>
          <p className="mt-2 text-gri">İlk ilanını yapıştır, birlikte başlayalım.</p>
          <a
            href="/analyze"
            className="mt-6 inline-block rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline"
          >
            İlk analizini yap
          </a>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-flow-col md:auto-cols-[minmax(14rem,1fr)] md:overflow-x-auto md:pb-2 xl:grid-flow-row xl:grid-cols-5 xl:overflow-visible">
          {ASAMALAR.map((asama) => (
            <section key={asama} className="rounded-kart border border-cizgi bg-metin/[0.03] p-3">
              <header className="px-1 pb-3">
                <h2 className="m-0 flex items-center justify-between text-sm">
                  {ASAMA_ETIKETI[asama]}
                  <span className="rounded-full bg-kart px-2 py-0.5 text-xs font-semibold text-gri">
                    {sutunlar[asama].length}
                  </span>
                </h2>
                {SUTUN_ALTI[asama] && sutunlar[asama].length > 0 && (
                  <p className="m-0 mt-1 text-xs text-gri">{SUTUN_ALTI[asama]}</p>
                )}
              </header>
              <div className="space-y-3">
                {sutunlar[asama].map((k) => (
                  <Kart key={k.analysisId} kart={k} onGuncelle={guncelle} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  )
}

function Kart({
  kart,
  onGuncelle,
}: {
  kart: PanoKarti
  onGuncelle: (id: string, d: { asama?: Asama; not?: string }) => Promise<void>
}) {
  const [notAcik, setNotAcik] = useState(false)
  const [not, setNot] = useState(kart.not ?? "")
  const [uyarlaniyor, setUyarlaniyor] = useState(false)
  const etiket = kart.skor === null ? null : skorEtiketi(kart.skor)

  async function uyarla() {
    setUyarlaniyor(true)
    const cevap = await fetch("/api/adapt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ analysisId: kart.analysisId }),
    })
    const govde = (await cevap.json()) as { adaptationId?: string }
    if (cevap.ok && govde.adaptationId) {
      window.location.href = `/adapt/${govde.adaptationId}`
      return
    }
    setUyarlaniyor(false)
  }

  function notuKaydet() {
    setNotAcik(false)
    if (not.trim() !== (kart.not ?? "")) void onGuncelle(kart.analysisId, { not: not.trim() })
  }

  return (
    <article className="rounded-buton border border-cizgi bg-kart p-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <h3 className="m-0 text-[15px] leading-snug">{kart.pozisyon}</h3>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {etiket && kart.skor !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${etiket.sinif}`}
            title="ATS uyum skoru"
          >
            {kart.skor} · {etiket.metin}
          </span>
        )}
        <span className="text-xs text-gri">{TARIH.format(new Date(kart.olusturulma))}</span>
      </div>

      {notAcik ? (
        <textarea
          autoFocus
          value={not}
          maxLength={NOT_UZUNLUGU}
          onChange={(e) => setNot(e.target.value)}
          onBlur={notuKaydet}
          rows={3}
          placeholder="Şirket, görüştüğün kişi, tarih…"
          className="mt-3 w-full rounded-buton border border-cizgi bg-zemin p-2 text-sm dark:bg-white/5"
        />
      ) : kart.not ? (
        <button
          onClick={() => setNotAcik(true)}
          className="mt-3 block w-full rounded-buton bg-zemin p-2 text-left text-sm text-metin dark:bg-white/5"
        >
          {kart.not}
        </button>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`asama-${kart.analysisId}`}>
          Aşama
        </label>
        <select
          id={`asama-${kart.analysisId}`}
          value={kart.asama}
          onChange={(e) => void onGuncelle(kart.analysisId, { asama: e.target.value as Asama })}
          className="rounded-buton border border-cizgi bg-kart px-2 py-1.5 text-sm"
        >
          {ASAMALAR.map((a) => (
            <option key={a} value={a}>
              {ASAMA_ETIKETI[a]}
            </option>
          ))}
        </select>

        {kart.uyarlama ? (
          <a href={`/adapt/${kart.uyarlama.id}`} className="text-sm font-semibold text-mavi dark:text-[#8ea2ff]">
            Uyarlamayı aç
          </a>
        ) : (
          <button
            onClick={() => void uyarla()}
            disabled={uyarlaniyor}
            className="text-sm font-semibold text-mavi dark:text-[#8ea2ff] disabled:opacity-50"
          >
            {uyarlaniyor ? "Hazırlanıyor…" : "Uyarla"}
          </button>
        )}

        {!notAcik && !kart.not && (
          <button onClick={() => setNotAcik(true)} className="ml-auto text-sm text-gri hover:text-metin">
            Not ekle
          </button>
        )}
      </div>
    </article>
  )
}
