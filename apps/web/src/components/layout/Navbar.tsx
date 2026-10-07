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
import { displayName } from "@/features/account/displayName"
import { Logo } from "@/components/layout/Logo"
import { loginPath } from "@/lib/returnPath"
import { CONTAINER } from "@/components/layout/PageShell"

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

const MARKETING_LINKS = [
  { href: "/#nasil", label: "Nasıl çalışır" },
  { href: "/#ozellikler", label: "Özellikler" },
  { href: "/#durustluk", label: "Dürüstlük" },
  { href: "/#sss", label: "SSS" },
]

const APP_LINKS = [
  { href: "/dashboard", label: "Genel bakış", Icon: LayoutDashboard },
  { href: "/analyze", label: "Yeni analiz", Icon: FileSearch },
  { href: "/applications", label: "Başvuru panosu", Icon: LayoutGrid },
]

export function Navbar() {
  const path = usePathname()
  const { data, isPending } = useSession()

  if (path.startsWith("/login") || path.startsWith("/onboarding")) return null

  const currentUser = data?.user
  const registered =
    !isPending && !!currentUser && !(currentUser as { isAnonymous?: boolean | null }).isAnonymous
  const onLanding = path === "/"

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
      <div className={cn(CONTAINER, "flex h-16 max-w-[75rem] items-center gap-2")}>
        <Logo href={registered ? "/dashboard" : "/"} className="mr-4" />

        <nav className="flex min-w-0 items-center gap-1" aria-label="Ana menü">
          {registered
            ? APP_LINKS.map(({ href, label, Icon }) => {
                const isActive = path === href || path.startsWith(`${href}/`)
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-button px-2.5 py-2 text-sm font-medium no-underline transition-colors sm:px-3",
                      isActive ? "bg-brand-blue/10 text-brand-blue" : "text-muted hover:bg-background hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {/* Dar ekranda yalnızca ikon; etiket ekran okuyucuya açık. */}
                    <span className="sr-only md:not-sr-only">{label}</span>
                  </Link>
                )
              })
            : onLanding
              ? MARKETING_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="hidden rounded-button px-3 py-2 text-sm font-medium text-muted no-underline transition-colors hover:text-foreground md:inline-flex"
                  >
                    {label}
                  </Link>
                ))
              : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Yalnızca oturum kısmı bekletiliyor, çubuğun tamamı değil:
              tümünü gizlemek yerleşimi zıplatıyor. */}
          {isPending ? (
            <span className="size-9" />
          ) : registered ? (
            <AccountMenu userName={displayName(currentUser)} userEmail={currentUser.email} isActive={path === "/account"} />
          ) : (
            <>
              <Link
                href={loginPath(path)}
                className="inline-flex items-center gap-2 rounded-button px-3 py-2 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-background"
              >
                <LogIn className="size-4" aria-hidden />
                Giriş yap
              </Link>
              {onLanding && (
                <Link
                  href="/analyze"
                  className="hidden rounded-button bg-brand-blue px-4 py-2 text-sm font-semibold text-white no-underline shadow-sm shadow-brand-blue/30 transition hover:bg-brand-blue/90 sm:inline-flex"
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
function AccountMenu({ userName, userEmail, isActive }: { userName: string; userEmail: string; isActive: boolean }) {
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Açılınca ilk öğeye odaklan; dışarı tıklama ve Esc kapatır.
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus()
    const outside = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false)
    }
    const pressedKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", pressedKey)
    return () => {
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", pressedKey)
    }
  }, [open])

  /** Yukarı/aşağı ok öğeler arasında dolaştırıyor. */
  function handleArrows(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
    e.preventDefault()
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const direction = e.key === "ArrowDown" ? 1 : -1
    items[(i + direction + items.length) % items.length]?.focus()
  }

  const initial = (userName[0] ?? "?").toLocaleUpperCase("tr-TR")
  const item =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground no-underline outline-none hover:bg-background focus-visible:bg-background"

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Hesap menüsü"
        onClick={() => setOpen((a) => !a)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1 text-muted transition-colors hover:bg-background hover:text-foreground",
          (open || isActive) && "bg-background text-foreground",
        )}
      >
        <span className="grid size-8 place-items-center rounded-full bg-brand-blue font-heading text-sm font-extrabold text-white">
          {initial}
        </span>
        {/* Ad (DOG-50); onboarding'i atlayanda e-posta. Dar ekranda yalnızca baş harf. */}
        <span className="hidden max-w-40 truncate text-sm font-medium text-foreground sm:inline">{userName}</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Hesap"
          onKeyDown={handleArrows}
          className="absolute top-full right-0 mt-2 w-64 rounded-card border border-border bg-card p-1.5 shadow-lg shadow-black/10"
        >
          <div className="px-3 pt-2 pb-2.5">
            <p className="m-0 truncate text-sm font-semibold text-foreground" title={userName}>
              {userName}
            </p>
            {userName !== userEmail && (
              <p className="m-0 mt-0.5 truncate text-xs text-muted" title={userEmail}>
                {userEmail}
              </p>
            )}
          </div>
          <div className="my-1 h-px bg-border" role="separator" />
          <Link role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} href="/account" className={item}>
            <Settings className="size-4 text-muted" aria-hidden />
            Hesap ayarları
          </Link>
          <div className="my-1 h-px bg-border" role="separator" />
          <Link role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} href="/privacy" className={item}>
            <ShieldCheck className="size-4 text-muted" aria-hidden />
            KVKK aydınlatma metni
          </Link>
          <Link role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} href="/terms" className={item}>
            <FileText className="size-4 text-muted" aria-hidden />
            Kullanım koşulları
          </Link>
          <div className="my-1 h-px bg-border" role="separator" />
          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            onClick={async () => {
              await signOut()
              window.location.href = "/"
            }}
            className={item}
          >
            <LogOut className="size-4 text-muted" aria-hidden />
            Çıkış yap
          </button>
        </div>
      )}
    </div>
  )
}
