"use client"

export interface FormatBulguView {
  kod: string
  seviye: "sorun" | "uyari"
  baslik: string
  aciklama: string
}

export interface FormatRaporuView {
  bulgular: FormatBulguView[]
  gecenler: string[]
}

/**
 * CV'nin ATS okunabilirliği. Skordan ayrı bir soru: skor "ilana uyuyor mu",
 * bu bölüm "ATS doğru okuyabilir mi". Durum renkleri yalnızca durumu
 * anlatıyor ve her zaman bir etiketle birlikte (rehber §9.2).
 */
export function BicimRaporu({ rapor }: { rapor: FormatRaporuView }) {
  const sorun = rapor.bulgular.filter((b) => b.seviye === "sorun").length
  const uyari = rapor.bulgular.length - sorun

  return (
    <section className="mt-9 rounded-kart border border-cizgi bg-kart p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-lg">ATS okunabilirliği</h2>
        <p className="m-0 text-sm text-gri">
          {sorun > 0 && <span className="font-semibold text-kirmizi">{sorun} sorun</span>}
          {sorun > 0 && uyari > 0 && " · "}
          {uyari > 0 && <span className="font-semibold text-kehribar">{uyari} uyarı</span>}
          {rapor.bulgular.length > 0 && " · "}
          <span className="text-yesil">{rapor.gecenler.length} kontrol geçti</span>
        </p>
      </div>

      {rapor.bulgular.length === 0 ? (
        <p className="mt-3 text-sm text-gri">
          CV&apos;nde ATS&apos;in okumasını zorlaştıracak bir biçim sorunu bulmadık.
        </p>
      ) : (
        <ul className="mt-4 list-none space-y-3 p-0">
          {rapor.bulgular.map((b) => (
            <li key={b.kod} className="flex gap-3">
              <span
                className={`mt-0.5 inline-flex h-5 w-16 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase tracking-wide ${
                  b.seviye === "sorun"
                    ? "bg-kirmizi/10 text-kirmizi"
                    : "bg-kehribar/15 text-kehribar"
                }`}
              >
                {b.seviye === "sorun" ? "Sorun" : "Uyarı"}
              </span>
              <div>
                <p className="m-0 font-semibold">{b.baslik}</p>
                <p className="m-0 mt-0.5 text-sm text-gri">{b.aciklama}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {rapor.gecenler.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gri">Geçen kontroller</summary>
          <p className="mt-2 text-sm text-gri">✓ {rapor.gecenler.join(" · ")}</p>
        </details>
      )}
    </section>
  )
}
