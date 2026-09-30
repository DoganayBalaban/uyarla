import { SayfaKabi } from "./components/Sayfa"

export const metadata = { title: "Sayfa bulunamadı · uyarla" }

/** Next'in varsayılan İngilizce 404'ü yerine. */
export default function NotFound() {
  return (
    <SayfaKabi genislik="dar" className="sm:pt-20">
      <p className="font-baslik text-sm font-bold tracking-wide text-mavi">404</p>
      <h1 className="mt-3 font-baslik text-3xl font-extrabold tracking-tight text-metin sm:text-4xl">
        Aradığın sayfa burada değil.
      </h1>
      <p className="mt-4 max-w-xl text-gri">
        Bağlantı eskimiş ya da adres yanlış yazılmış olabilir. Analizlerin ve başvuruların yerinde duruyor.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="/analyze"
          className="rounded-buton bg-mavi px-5 py-2.5 text-sm font-semibold text-white hover:bg-mavi/90"
        >
          CV'ni analiz et
        </a>
        <a
          href="/"
          className="rounded-buton border border-cizgi px-5 py-2.5 text-sm font-semibold text-metin hover:bg-kart"
        >
          Ana sayfaya dön
        </a>
      </div>
    </SayfaKabi>
  )
}
