"use client"

import { FileSearch, LayoutGrid, LogIn, LogOut } from "lucide-react"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "@/lib/authClient"
import { cn } from "@/lib/cn"
import { girisAdresi } from "@/lib/donus"

/**
 * Uygulama ekranlarının üst çubuğu: logo, gezinme ve oturum durumu.
 *
 * Sayfanın üstüne yapışık ve yarı saydam; bulunulan sayfa vurgulanıyor.
 * Dar ekranda bağlantılar yalnızca ikon (etiket ekran okuyucuya açık).
 *
 * Anonim oturum "giriş yapılmış" sayılmıyor: kullanıcı açısından o bir oturum
 * değil, sadece işinin kaybolmamasını sağlayan bir iz. Üstelik anonim
 * kullanıcının e-postası Better Auth'un ürettiği bir yer tutucu
 * (…@anonymous.placeholder.invalid) ve gösterilmesi kafa karıştırırdı.
 */
export function OturumCubugu({ genis = false }: { genis?: boolean }) {
  const { data, isPending } = useSession()
  // Girişten sonra kullanıcı bulunduğu sayfaya dönüyor.
  const yol = usePathname()

  const kullanici = data?.user
  const kayitli =
    !isPending && kullanici && !(kullanici as { isAnonymous?: boolean | null }).isAnonymous

  const baglantilar = [
    { href: "/analyze", etiket: "Yeni analiz", Ikon: FileSearch, gorunur: true },
    { href: "/applications", etiket: "Başvuru panosu", Ikon: LayoutGrid, gorunur: !!kayitli },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-cizgi bg-kart/80 backdrop-blur-md supports-[backdrop-filter]:bg-kart/70">
      <div
        className={cn(
          "mx-auto flex h-16 items-center gap-3 px-4 sm:px-6",
          genis ? "max-w-7xl" : "max-w-5xl",
        )}
      >
        <a
          href="/"
          className="mr-2 inline-flex items-center gap-2 font-baslik text-lg font-extrabold tracking-tight text-metin"
        >
          {/* Rehber §9.1: üst üste iki belge, biri hafif eğik. */}
          <span aria-hidden className="relative h-5 w-4">
            <span className="absolute inset-0 -translate-x-0.5 -rotate-12 rounded-[4px] bg-mavi/30" />
            <span className="absolute inset-0 rounded-[4px] bg-mavi" />
          </span>
          uyarla
        </a>

        <nav className="flex items-center gap-1" aria-label="Uygulama">
          {baglantilar
            .filter((b) => b.gorunur)
            .map(({ href, etiket, Ikon }) => {
              const aktif = yol === href || yol.startsWith(`${href}/`)
              return (
                <a
                  key={href}
                  href={href}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-buton px-2.5 py-2 text-sm font-medium transition-colors sm:px-3",
                    aktif
                      ? "bg-mavi/10 text-mavi dark:text-[#8ea2ff]"
                      : "text-gri hover:bg-zemin hover:text-metin",
                  )}
                >
                  <Ikon className="size-4" aria-hidden />
                  <span className="sr-only sm:not-sr-only">{etiket}</span>
                </a>
              )
            })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Yalnızca oturum kısmı bekletiliyor, çubuğun tamamı değil: tümünü
              gizlemek yerleşimi zıplatıyor. */}
          {isPending ? (
            <span className="size-9" />
          ) : kayitli ? (
            <>
              {/* E-posta hesap ekranına açılıyor: silme akışına girişin
                  başka bir kapısı yok ve "istediğin an silebilirsin" sözünün
                  ulaşılamaz olması sözü tutmamakla aynı şey. */}
              <a
                href="/account"
                title={kullanici.email}
                aria-current={yol === "/account" ? "page" : undefined}
                className="inline-flex items-center gap-2 rounded-full py-1 pr-1 pl-1 text-sm text-gri transition-colors hover:bg-zemin hover:text-metin sm:pl-3"
              >
                <span className="hidden max-w-[14rem] truncate md:inline">{kullanici.email}</span>
                <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#8ea2ff] to-mavi font-baslik text-sm font-extrabold text-white uppercase">
                  {kullanici.email?.[0] ?? "?"}
                </span>
                <span className="sr-only">Hesabım</span>
              </a>
              <button
                onClick={() => void signOut()}
                className="grid size-9 place-items-center rounded-full text-gri transition-colors hover:bg-zemin hover:text-metin"
                aria-label="Çıkış yap"
                title="Çıkış yap"
              >
                <LogOut className="size-4" aria-hidden />
              </button>
            </>
          ) : (
            <a
              href={girisAdresi(yol)}
              className="inline-flex items-center gap-2 rounded-buton border border-cizgi bg-kart px-3 py-2 text-sm font-semibold text-metin transition-colors hover:border-metin/25"
            >
              <LogIn className="size-4" aria-hidden />
              Giriş yap
            </a>
          )}
        </div>
      </div>
    </header>
  )
}
