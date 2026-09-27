"use client"

import { useEffect, useState } from "react"

interface Kontrol {
  status: "ok" | "flagged"
  issues: Array<{ kind: string; detail: string }>
}

export type OnYaziKaydiView =
  | { durum: "running" }
  | { durum: "failed" }
  | { durum: "done"; paragraflar: Array<{ metin: string; kontrol: Kontrol }>; olusturulma: string }

/**
 * Uyarlama ekranındaki ön yazı bölümü.
 *
 * Kendi yoklamasını yapıyor: uyarlama ekranının yoklaması uyarlama bitince
 * duruyor, ön yazı ise sonradan istenen ayrı bir iş.
 */
export function OnYaziBolumu({
  adaptationId,
  baslangic,
}: {
  adaptationId: string
  baslangic: OnYaziKaydiView | null
}) {
  const [kayit, setKayit] = useState<OnYaziKaydiView | null>(baslangic)
  const [hata, setHata] = useState<string | null>(null)
  const [kopyalandi, setKopyalandi] = useState(false)

  const calisiyor = kayit?.durum === "running"

  useEffect(() => {
    if (!calisiyor) return
    let durduruldu = false
    void (async () => {
      while (!durduruldu) {
        await new Promise((r) => setTimeout(r, 2000))
        if (durduruldu) return
        const cevap = await fetch(`/api/adapt/${adaptationId}`)
        if (!cevap.ok) return
        const { coverLetter } = (await cevap.json()) as { coverLetter: OnYaziKaydiView | null }
        setKayit(coverLetter)
        if (coverLetter?.durum !== "running") return
      }
    })()
    return () => {
      durduruldu = true
    }
  }, [calisiyor, adaptationId])

  async function olustur() {
    setHata(null)
    setKopyalandi(false)
    const cevap = await fetch(`/api/adapt/${adaptationId}/cover-letter`, { method: "POST" })
    const govde = (await cevap.json()) as { coverLetter?: OnYaziKaydiView; error?: string }
    if (!cevap.ok || !govde.coverLetter) {
      setHata(govde.error ?? "Ön yazıyı başlatamadık. Birazdan tekrar dener misin?")
      return
    }
    setKayit(govde.coverLetter)
  }

  const metin =
    kayit?.durum === "done" ? kayit.paragraflar.map((p) => p.metin).join("\n\n") : ""
  const isaretli = kayit?.durum === "done" ? kayit.paragraflar.filter((p) => p.kontrol.status === "flagged").length : 0

  async function kopyala() {
    await navigator.clipboard.writeText(metin)
    setKopyalandi(true)
  }

  function indir() {
    const url = URL.createObjectURL(new Blob([metin], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "uyarla-on-yazi.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="mt-10 rounded-kart border border-cizgi bg-white p-5 dark:bg-kart">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg">Ön yazı</h2>
          <p className="m-0 mt-1 text-sm text-gri">
            Bu ilana ve CV&apos;ndeki gerçek deneyimine özel, üç paragraflık bir ön yazı.
          </p>
        </div>
        {kayit?.durum !== "running" && (
          <button
            onClick={() => void olustur()}
            className={
              kayit?.durum === "done"
                ? "rounded-buton border border-cizgi px-5 py-2.5 font-semibold"
                : "rounded-buton bg-mavi px-5 py-2.5 font-semibold text-white"
            }
          >
            {kayit?.durum === "done" ? "Yeniden yaz" : "Ön yazı oluştur"}
          </button>
        )}
      </div>

      {hata && <p className="mt-3 text-sm text-kehribar">{hata}</p>}

      {calisiyor && (
        <p className="mt-4 flex items-center gap-2.5 text-sm text-gri" role="status">
          <span className="size-4 animate-spin rounded-full border-2 border-cizgi border-t-mavi" />
          Ön yazını yazıyoruz, sonra hiçbir şeyin uydurulmadığını kontrol ediyoruz…
        </p>
      )}

      {kayit?.durum === "failed" && (
        <p className="mt-4 text-sm text-kehribar">
          Ön yazıyı yazamadık. “Ön yazı oluştur” ile tekrar dener misin?
        </p>
      )}

      {kayit?.durum === "done" && (
        <>
          {isaretli > 0 && (
            <p className="mt-4 text-sm text-kehribar">
              {isaretli} paragrafta CV&apos;nde olmayan bir bilgi olabilir. Kullanmadan önce
              işaretli yerleri düzelt ya da çıkar.
            </p>
          )}
          <div className="mt-4 space-y-3">
            {kayit.paragraflar.map((p, i) => (
              <div
                key={i}
                className={
                  p.kontrol.status === "flagged"
                    ? "rounded-buton border border-kehribar/40 bg-kehribar/5 p-3"
                    : "p-3"
                }
              >
                {p.kontrol.status === "flagged" && (
                  <>
                    <span className="mb-1.5 inline-block rounded-full bg-kehribar/20 px-2 py-0.5 text-xs font-bold text-kehribar">
                      Kontrol et
                    </span>
                    {p.kontrol.issues.map((s, j) => (
                      <p key={j} className="m-0 mb-1.5 text-sm text-kehribar">
                        {s.detail}
                      </p>
                    ))}
                  </>
                )}
                <p className="m-0 leading-relaxed">{p.metin}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void kopyala()}
              className="rounded-buton bg-mavi px-5 py-2.5 font-semibold text-white"
            >
              {kopyalandi ? "Kopyalandı" : "Metni kopyala"}
            </button>
            <button
              onClick={indir}
              className="rounded-buton border border-cizgi px-5 py-2.5 font-semibold"
            >
              Metin olarak indir
            </button>
          </div>
          <p className="mt-4 text-xs text-gri">
            Yapay zekâ ile yazıldı ve CV&apos;ndeki bilgilerle karşılaştırıldı. Göndermeden önce
            okuyup kendi sesine göre düzenle.
          </p>
        </>
      )}
    </section>
  )
}
