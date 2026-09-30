"use client"

import Link from "next/link"
import {
  ChevronDown,
  FileSearch,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { signOut, useSession } from "@/lib/authClient"
import { cn } from "@/lib/cn"
import { girisAdresi } from "@/lib/donus"
import { KAP } from "./Sayfa"

/**
 * Bütün sayfaların üst çubuğu; kök layout'ta bir kez çiziliyor. Yapı, yükseklik
 * ve hizalama her sayfada aynı, yalnızca içerik oturuma göre değişiyor:
 *
 * - Ziyaretçi (anonim oturum dahil): tanıtım bölümleri ya da yeni analiz,
 *   sağda giriş.
 * - Kayıtlı kullanıcı: uygulama bağlantıları, sağda hesap menüsü.
 *
 * Anonim oturum "giriş yapılmış" sayılmıyor: kullanıcı açısından o bir oturum
 * değil, işinin kaybolmaması için bir iz. E-postası da Better Auth'un ürettiği
 * bir yer tutucu (…@anonymous.placeholder.invalid).
 *
 * Giriş ekranı kendi bölünmüş düzenini çiziyor; orada çubuk yok.
 */

const TANITIM_BAGLANTILARI = [
  { href: "/#nasil", etiket: "Nasıl çalışır" },
  { href: "/#ozellikler", etiket: "Özellikler" },
  { href: "/#durustluk", etiket: "Dürüstlük" },
  { href: "/#sss", etiket: "SSS" },
]

const UYGULAMA_BAGLANTILARI = [
  { href: "/dashboard", etiket: "Genel bakış", Ikon: LayoutDashboard },
  { href: "/analyze", etiket: "Yeni analiz", Ikon: FileSearch },
  { href: "/applications", etiket: "Başvuru panosu", Ikon: LayoutGrid },
]

export function Navbar() {
  const yol = usePathname()
  const { data, isPending } = useSession()

  if (yol.startsWith("/login")) return null

  const kullanici = data?.user
  const kayitli =
    !isPending && !!kullanici && !(kullanici as { isAnonymous?: boolean | null }).isAnonymous
  const tanitimda = yol === "/"

  return (
    <header className="sticky top-0 z-40 border-b border-cizgi bg-kart/85 backdrop-blur-md">
      <div className={cn(KAP, "flex h-16 max-w-[75rem] items-center gap-2")}>
        <Link
          href={kayitli ? "/dashboard" : "/"}
          aria-label="uyarla ana sayfa"
          className="mr-4 inline-flex items-center gap-2.5 font-baslik text-xl font-extrabold tracking-tight text-metin no-underline"
        >
          {/* Rehber §9.1: üst üste iki belge, biri hafif eğik. */}
          <span aria-hidden className="relative h-6 w-5">
            <span className="absolute inset-0 -translate-x-0.5 -rotate-12 rounded-[5px] bg-mavi/30" />
            <span className="absolute inset-0 rounded-[5px] bg-mavi" />
          </span>
          uyarla
        </Link>

        <nav className="flex min-w-0 items-center gap-1" aria-label="Ana menü">
          {kayitli
            ? UYGULAMA_BAGLANTILARI.map(({ href, etiket, Ikon }) => {
                const aktif = yol === href || yol.startsWith(`${href}/`)
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={aktif ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-buton px-2.5 py-2 text-sm font-medium no-underline transition-colors sm:px-3",
                      aktif ? "bg-mavi/10 text-mavi" : "text-gri hover:bg-zemin hover:text-metin",
                    )}
                  >
                    <Ikon className="size-4" aria-hidden />
                    {/* Dar ekranda yalnızca ikon; etiket ekran okuyucuya açık. */}
                    <span className="sr-only md:not-sr-only">{etiket}</span>
                  </Link>
                )
              })
            : tanitimda
              ? TANITIM_BAGLANTILARI.map(({ href, etiket }) => (
                  <Link
                    key={href}
                    href={href}
                    className="hidden rounded-buton px-3 py-2 text-sm font-medium text-gri no-underline transition-colors hover:text-metin md:inline-flex"
                  >
                    {etiket}
                  </Link>
                ))
              : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Yalnızca oturum kısmı bekletiliyor, çubuğun tamamı değil:
              tümünü gizlemek yerleşimi zıplatıyor. */}
          {isPending ? (
            <span className="size-9" />
          ) : kayitli ? (
            <HesapMenusu eposta={kullanici.email} aktif={yol === "/account"} />
          ) : (
            <>
              <Link
                href={girisAdresi(yol)}
                className="inline-flex items-center gap-2 rounded-buton px-3 py-2 text-sm font-semibold text-metin no-underline transition-colors hover:bg-zemin"
              >
                <LogIn className="size-4" aria-hidden />
                Giriş yap
              </Link>
              {tanitimda && (
                <Link
                  href="/analyze"
                  className="hidden rounded-buton bg-mavi px-4 py-2 text-sm font-semibold text-white no-underline shadow-sm shadow-mavi/30 transition hover:bg-mavi/90 sm:inline-flex"
                >
                  Ücretsiz skorumu gör
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}

/**
 * Hesap düğmesi ve açılır menüsü. E-posta menünün başında duruyor; hesap
 * ayarları silme akışının tek kapısı, "istediğin an silebilirsin" sözü
 * ulaşılamaz olursa tutulmamış olur.
 */
function HesapMenusu({ eposta, aktif }: { eposta: string; aktif: boolean }) {
  const [acik, setAcik] = useState(false)
  const kap = useRef<HTMLDivElement>(null)
  const dugme = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  // Açılınca ilk öğeye odaklan; dışarı tıklama ve Esc kapatır.
  useEffect(() => {
    if (!acik) return
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus()
    const disari = (e: PointerEvent) => {
      if (!kap.current?.contains(e.target as Node)) setAcik(false)
    }
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAcik(false)
        dugme.current?.focus()
      }
    }
    document.addEventListener("pointerdown", disari)
    document.addEventListener("keydown", tus)
    return () => {
      document.removeEventListener("pointerdown", disari)
      document.removeEventListener("keydown", tus)
    }
  }, [acik])

  /** Yukarı/aşağı ok öğeler arasında dolaştırıyor. */
  function oklar(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    e.preventDefault()
    const ogeler = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])]
    const i = ogeler.indexOf(document.activeElement as HTMLElement)
    const yon = e.key === "ArrowDown" ? 1 : -1
    ogeler[(i + yon + ogeler.length) % ogeler.length]?.focus()
  }

  const basHarf = (eposta[0] ?? "?").toLocaleUpperCase("tr-TR")
  const oge =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-metin no-underline outline-none hover:bg-zemin focus-visible:bg-zemin"

  return (
    <div ref={kap} className="relative">
      <button
        ref={dugme}
        type="button"
        aria-haspopup="menu"
        aria-expanded={acik}
        aria-label="Hesap menüsü"
        onClick={() => setAcik((a) => !a)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1 text-gri transition-colors hover:bg-zemin hover:text-metin",
          (acik || aktif) && "bg-zemin text-metin",
        )}
      >
        <span className="grid size-8 place-items-center rounded-full bg-mavi font-baslik text-sm font-extrabold text-white">
          {basHarf}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", acik && "rotate-180")} aria-hidden />
      </button>

      {acik && (
        <div
          ref={menu}
          role="menu"
          aria-label="Hesap"
          onKeyDown={oklar}
          className="absolute top-full right-0 mt-2 w-64 rounded-kart border border-cizgi bg-kart p-1.5 shadow-lg shadow-black/10"
        >
          <div className="px-3 pt-2 pb-2.5">
            <p className="m-0 text-xs text-gri">Giriş yapılan hesap</p>
            <p className="m-0 mt-0.5 truncate text-sm font-semibold text-metin" title={eposta}>
              {eposta}
            </p>
          </div>
          <div className="my-1 h-px bg-cizgi" role="separator" />
          <Link role="menuitem" tabIndex={-1} onClick={() => setAcik(false)} href="/account" className={oge}>
            <Settings className="size-4 text-gri" aria-hidden />
            Hesap ayarları
          </Link>
          <div className="my-1 h-px bg-cizgi" role="separator" />
          <Link role="menuitem" tabIndex={-1} onClick={() => setAcik(false)} href="/privacy" className={oge}>
            <ShieldCheck className="size-4 text-gri" aria-hidden />
            KVKK aydınlatma metni
          </Link>
          <Link role="menuitem" tabIndex={-1} onClick={() => setAcik(false)} href="/terms" className={oge}>
            <FileText className="size-4 text-gri" aria-hidden />
            Kullanım koşulları
          </Link>
          <div className="my-1 h-px bg-cizgi" role="separator" />
          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={async () => {
              await signOut()
              window.location.href = "/"
            }}
            className={oge}
          >
            <LogOut className="size-4 text-gri" aria-hidden />
            Çıkış yap
          </button>
        </div>
      )}
    </div>
  )
}
