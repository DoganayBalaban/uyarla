"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogIn } from "lucide-react"
import { Logo } from "@/components/layout/Logo"
import { PageActionsSlot } from "@/components/layout/app-shell/PageActions"
import { Button } from "@/components/ui/button"
import { loginPath } from "@/lib/returnPath"

/**
 * Kayıtsız ziyaretçinin üst çubuğu. Kenar çubuğu, ⌘K ve konum yolu yok:
 * ziyaretçinin açabildiği tek iş analiz; kilitli menü ögeleri ilk denemeyi
 * dağıtıyordu. Sayfa eylemleri (sonuçta "Yeni analiz") yine burada.
 */
export function VisitorHeader() {
  const path = usePathname()
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Logo />
        <div className="ml-auto flex items-center gap-2">
          <PageActionsSlot className="flex items-center gap-2 empty:hidden" />
          <Button asChild variant="ghost" size="sm">
            <Link href={loginPath(path)}>
              <LogIn aria-hidden />
              Giriş yap
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
