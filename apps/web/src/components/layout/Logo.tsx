import Link from "next/link"
import { UyarlaLogo } from "@/components/brand/UyarlaMark"

/** Marka logosu (im + yazı), ana sayfaya bağlantı. Renk metin renginden. */
export function Logo({ className = "", href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} aria-label="uyarla ana sayfa" className={`inline-flex items-center text-foreground no-underline ${className}`}>
      <UyarlaLogo className="h-7 w-auto" />
    </Link>
  )
}
