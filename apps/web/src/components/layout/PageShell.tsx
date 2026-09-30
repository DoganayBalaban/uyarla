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
const WIDTH = {
  wide: "",
  medium: "max-w-5xl",
  narrow: "max-w-3xl",
} as const

export type PageWidth = keyof typeof WIDTH

/** Navbar'ın ve geniş sayfaların ortak kabı; sağ-sol boşluk tek yerde. */
export const CONTAINER = "mx-auto w-full px-4 sm:px-6"

export function PageShell({
  width = "medium",
  className,
  children,
}: {
  width?: PageWidth
  className?: string
  children: React.ReactNode
}) {
  return (
    <main className={cn(CONTAINER, "max-w-[75rem] pt-10 pb-20 sm:pt-12", className)}>
      <div className={WIDTH[width]}>{children}</div>
    </main>
  )
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** Sağda duran tek birincil eylem (rehber §9.5). */
  action?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 max-w-2xl">
        <h1 className="m-0 font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description && <p className="m-0 mt-2 text-muted">{description}</p>}
      </div>
      {action}
    </header>
  )
}
