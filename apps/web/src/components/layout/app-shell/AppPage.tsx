import { FadeIn } from "@/components/motion"
import { cn } from "@/lib/cn"

/**
 * Uygulama sayfalarının kabı (DOG-144): başlık, açıklama, eylemler, içerik.
 * Kabuğun içinde çiziliyor; sayfanın tek <main>'i burada. İçerik kısa bir
 * fade ile geliyor.
 *
 * - default: liste ve pano ekranları (max-w-6xl)
 * - narrow:  form, okuma ve ayar ekranları
 */
const WIDTH = { default: "max-w-6xl", narrow: "max-w-3xl" } as const

export function AppPage({
  title,
  description,
  actions,
  width = "default",
  className,
  children,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  /** Başlığın sağında duran eylemler; birincil olan en sağda. */
  actions?: React.ReactNode
  width?: keyof typeof WIDTH
  className?: string
  children: React.ReactNode
}) {
  return (
    <main className={cn("mx-auto w-full px-4 pt-6 pb-16 sm:px-6 lg:pt-8", WIDTH[width], className)}>
      {title && (
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h1 className="m-0 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="m-0 mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <FadeIn>{children}</FadeIn>
    </main>
  )
}
