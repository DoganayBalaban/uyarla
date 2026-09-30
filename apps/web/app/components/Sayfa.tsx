import { cn } from "@/lib/cn"

/**
 * Sayfaların ortak yapı taşları. Her ekran bu ikisiyle çiziliyor ki kenar
 * boşluğu, başlık tipografisi ve dikey ritim sayfadan sayfaya değişmesin.
 *
 * Kap her sayfada navbar'la aynı; içerik logonun hizasından başlıyor ve
 * sayfadan sayfaya geçerken yana kaymıyor. Genişlik yalnızca içeriğin sağa
 * ne kadar uzandığını belirliyor, içerikten geliyor:
 * - genis: çok sütunlu ekranlar (dashboard, başvuru panosu)
 * - orta:  form ve sonuç ekranları (analiz, uyarlama)
 * - dar:   okuma ve ayar ekranları (hesap, yasal metinler, hata sayfaları)
 */
const GENISLIK = {
  genis: "",
  orta: "max-w-5xl",
  dar: "max-w-3xl",
} as const

export type SayfaGenisligi = keyof typeof GENISLIK

/** Navbar'ın ve geniş sayfaların ortak kabı; sağ-sol boşluk tek yerde. */
export const KAP = "mx-auto w-full px-4 sm:px-6"

export function SayfaKabi({
  genislik = "orta",
  className,
  children,
}: {
  genislik?: SayfaGenisligi
  className?: string
  children: React.ReactNode
}) {
  return (
    <main className={cn(KAP, "max-w-[75rem] pt-10 pb-20 sm:pt-12", className)}>
      <div className={GENISLIK[genislik]}>{children}</div>
    </main>
  )
}

export function SayfaBasligi({
  baslik,
  aciklama,
  eylem,
  className,
}: {
  baslik: React.ReactNode
  aciklama?: React.ReactNode
  /** Sağda duran tek birincil eylem (rehber §9.5). */
  eylem?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 max-w-2xl">
        <h1 className="m-0 font-baslik text-3xl font-extrabold tracking-tight text-metin sm:text-4xl">
          {baslik}
        </h1>
        {aciklama && <p className="m-0 mt-2 text-gri">{aciklama}</p>}
      </div>
      {eylem}
    </header>
  )
}
