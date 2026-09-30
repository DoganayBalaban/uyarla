"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowRight,
  CalendarDays,
  CircleAlert,
  GripVertical,
  Inbox,
  LayoutGrid,
  Plus,
  StickyNote,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { girisAdresi } from "@/lib/donus"
import { sonucAdresi } from "@/lib/aktifAnaliz"
import { SayfaBasligi } from "../components/Sayfa"
import {
  ASAMALAR,
  ASAMA_ETIKETI,
  ASAMA_RENGI,
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


/** Sürükle-bırak verisinin türü; başka sürüklemelerle karışmasın. */
const SURUKLE_TURU = "application/x-uyarla-kart"

const TARIH = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" })

/** Sütun başlığının altındaki kısa metin; rehber §6.2 tonunda. */
const SUTUN_ALTI: Partial<Record<Asama, string>> = {
  saved: "Skorunu aldın, henüz başvurmadın.",
  rejected: "Bu olmadı, olur.",
  offer: "Tebrikler!",
}

export function Pano() {
  const [yukleme, setYukleme] = useState<Yukleme>({ durum: "yukleniyor" })
  const [hedef, setHedef] = useState<Asama | null>(null)
  const azHareket = useReducedMotion() ?? false

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

  if (yukleme.durum === "yukleniyor") return <PanoIskeleti />
  if (yukleme.durum === "hata") {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-kart border border-cizgi bg-kart p-5 text-kirmizi dark:text-[#f87171]">
        <CircleAlert className="size-5 shrink-0" aria-hidden />
        {yukleme.mesaj}
      </p>
    )
  }
  if (yukleme.durum === "giris") {
    return (
      <div className="mx-auto max-w-md rounded-kart border border-cizgi bg-kart p-8 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-mavi/10 text-mavi">
          <LayoutGrid className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl">Başvuru panon</h1>
        <p className="mt-2 text-sm text-gri">
          Hangi ilana hangi CV ile başvurduğunu görmek için giriş yap. Kayıtsız yaptığın
          analizler hesabına taşınır.
        </p>
        <a
          href={girisAdresi("/applications")}
          className="mt-6 inline-flex items-center gap-2 rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-mavi/30"
        >
          Giriş yap
          <ArrowRight className="size-4" aria-hidden />
        </a>
      </div>
    )
  }

  const { kartlar } = yukleme
  const sutunlar = sutunlaraDagit(kartlar)
  const basvurulan = kartlar.filter((k) => k.asama !== "saved").length
  const mulakat = sutunlar.interview.length + sutunlar.offer.length

  return (
    <div>
      <SayfaBasligi
        baslik="Başvuru panon"
        aciklama={
          kartlar.length === 0
            ? "Her analiz buraya bir kart olarak düşer."
            : "Kartları sürükleyerek ya da aşama menüsünden taşıyabilirsin."
        }
        eylem={
          <a
            href="/analyze"
            className="inline-flex items-center gap-2 rounded-buton bg-mavi px-5 py-2.5 font-semibold text-white no-underline shadow-sm shadow-mavi/30 transition hover:bg-mavi/90"
          >
            <Plus className="size-4" aria-hidden />
            Yeni analiz
          </a>
        }
        className="mb-0"
      />

      {kartlar.length > 0 && (
        <dl className="mt-6 grid grid-cols-3 gap-3 sm:max-w-lg">
          {(
            [
              ["İlan", kartlar.length],
              ["Başvuru", basvurulan],
              ["Mülakat", mulakat],
            ] as const
          ).map(([etiket, sayi]) => (
            <div key={etiket} className="rounded-kart border border-cizgi bg-kart px-4 py-3">
              <dt className="text-xs font-semibold text-gri">{etiket}</dt>
              <dd className="m-0 font-baslik text-2xl font-extrabold tabular-nums">{sayi}</dd>
            </div>
          ))}
        </dl>
      )}

      {kartlar.length === 0 ? (
        <div className="mt-10 rounded-kart border border-dashed border-cizgi bg-kart/60 p-10 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-mavi/10 text-mavi">
            <Inbox className="size-6" aria-hidden />
          </span>
          {/* Rehber §10.2: boş pano metni, birebir. */}
          <p className="m-0 mt-4 font-baslik text-xl font-extrabold">Henüz başvuru yok.</p>
          <p className="mt-2 text-gri">İlk ilanını yapıştır, birlikte başlayalım.</p>
          <a
            href="/analyze"
            className="mt-6 inline-flex items-center gap-2 rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline shadow-sm shadow-mavi/30"
          >
            İlk analizini yap
            <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-flow-col md:auto-cols-[minmax(15rem,1fr)] md:overflow-x-auto md:pb-2 xl:grid-flow-row xl:grid-cols-5 xl:overflow-visible">
          {ASAMALAR.map((asama) => (
            <section
              key={asama}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(SURUKLE_TURU)) return
                e.preventDefault()
                setHedef(asama)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHedef(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setHedef(null)
                const id = e.dataTransfer.getData(SURUKLE_TURU)
                const kart = kartlar.find((k) => k.analysisId === id)
                if (kart && kart.asama !== asama) void guncelle(id, { asama })
              }}
              className={cn(
                "flex flex-col rounded-kart border bg-metin/[0.025] p-2.5 transition-colors",
                hedef === asama ? "border-mavi/50 bg-mavi/[0.06]" : "border-cizgi",
              )}
            >
              <header className="px-1.5 pt-1 pb-3">
                <h2 className="m-0 flex items-center gap-2 text-sm">
                  <span aria-hidden className={cn("size-2 rounded-full", ASAMA_RENGI[asama])} />
                  {ASAMA_ETIKETI[asama]}
                  <span className="ml-auto rounded-full bg-kart px-2 py-0.5 text-xs font-semibold text-gri tabular-nums">
                    {sutunlar[asama].length}
                  </span>
                </h2>
                {SUTUN_ALTI[asama] && sutunlar[asama].length > 0 && (
                  <p className="m-0 mt-1 text-xs text-gri">{SUTUN_ALTI[asama]}</p>
                )}
              </header>
              <div className="flex min-h-16 flex-1 flex-col gap-2.5">
                <AnimatePresence initial={false}>
                  {sutunlar[asama].map((k) => (
                    <motion.div
                      key={k.analysisId}
                      layout={!azHareket}
                      initial={azHareket ? false : { opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={azHareket ? undefined : { opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Kart kart={k} onGuncelle={guncelle} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {sutunlar[asama].length === 0 && (
                  <p className="m-0 grid flex-1 place-items-center rounded-buton border border-dashed border-cizgi px-3 py-5 text-center text-xs text-gri">
                    Kartı buraya bırak
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/** Yüklenirken sütunların kabaca şekli. */
function PanoIskeleti() {
  return (
    <div aria-busy="true" aria-label="Panon yükleniyor">
      <div className="h-8 w-56 rounded-buton bg-metin/[0.06] motion-safe:animate-pulse" />
      <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {ASAMALAR.map((a, i) => (
          <div key={a} className="space-y-2.5 rounded-kart border border-cizgi p-2.5">
            <div className="h-4 w-24 rounded bg-metin/[0.06]" />
            {Array.from({ length: i < 2 ? 2 : 1 }, (_, j) => (
              <div key={j} className="h-24 rounded-buton bg-metin/[0.05] motion-safe:animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
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
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(SURUKLE_TURU, kart.analysisId)
        e.dataTransfer.effectAllowed = "move"
      }}
      className="group rounded-buton border border-cizgi bg-kart p-3.5 shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition hover:border-mavi/30 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-1.5">
        <h3 className="m-0 flex-1 text-[15px] leading-snug">
          {/* Analiz sonucuna kalıcı adres; önceden sonuca geri dönmenin yolu yoktu (K3). */}
          <a
            href={sonucAdresi(kart.analysisId)}
            draggable={false}
            className="text-metin no-underline hover:text-mavi hover:underline"
          >
            {kart.pozisyon}
          </a>
        </h3>
        <GripVertical
          className="mt-0.5 size-4 shrink-0 cursor-grab text-gri opacity-0 transition group-hover:opacity-100"
          aria-hidden
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {etiket && kart.skor !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${etiket.sinif}`}
            title="ATS uyum skoru"
          >
            {kart.skor} · {etiket.metin}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-gri">
          <CalendarDays className="size-3.5" aria-hidden />
          {TARIH.format(new Date(kart.olusturulma))}
        </span>
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

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cizgi pt-3">
        <label className="sr-only" htmlFor={`asama-${kart.analysisId}`}>
          Aşama
        </label>
        <select
          id={`asama-${kart.analysisId}`}
          value={kart.asama}
          onChange={(e) => void onGuncelle(kart.analysisId, { asama: e.target.value as Asama })}
          className="rounded-buton border border-cizgi bg-kart px-2 py-1 text-xs font-medium"
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
          <button
            onClick={() => setNotAcik(true)}
            className="ml-auto inline-flex items-center gap-1 text-sm text-gri hover:text-metin"
          >
            <StickyNote className="size-3.5" aria-hidden />
            Not ekle
          </button>
        )}
      </div>
    </article>
  )
}
