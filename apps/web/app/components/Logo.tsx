import Link from "next/link"

/**
 * Marka imi ve adı: arkada hafif dönmüş, önde düz iki kart. Tanıtım sayfası
 * kendi CSS modülüyle aynı imi çiziyor.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="uyarla ana sayfa"
      className={`inline-flex items-center gap-2.5 font-baslik text-xl font-extrabold tracking-tight text-metin ${className}`}
    >
      <span aria-hidden="true" className="relative h-6 w-5">
        <span className="absolute inset-0 -translate-x-0.5 -rotate-12 rounded-[5px] bg-mavi/30" />
        <span className="absolute inset-0 rounded-[5px] bg-mavi" />
      </span>
      uyarla
    </Link>
  )
}
