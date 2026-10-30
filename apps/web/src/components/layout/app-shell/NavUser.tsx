"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { ChevronsUpDown, CreditCard, FileText, LogOut, Monitor, Moon, ReceiptText, Settings, ShieldCheck, Sun } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { displayName } from "@/features/account/displayName"
import { useBillingStatus } from "@/features/billing/api"
import { accessSummary } from "@/features/billing/format"
import { signOut } from "@/lib/authClient"

/**
 * Kenar çubuğunun altındaki kullanıcı menüsü (DOG-144): hesap, paketler, tema,
 * yasal metinler, çıkış. Hesap ayarları silme akışının da kapısı; "istediğin
 * an silebilirsin" sözü ulaşılamaz olmasın (Navbar'daki menüyle aynı).
 */
export function NavUser({ name, email }: { name: string | null; email: string }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const billing = useBillingStatus()
  const shown = displayName({ name, email })
  const initial = (shown[0] ?? "?").toLocaleUpperCase("tr-TR")
  const access = billing.data ? accessSummary(billing.data, new Date()) : null
  const close = () => setOpenMobile(false)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" aria-label="Hesap menüsü">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary font-semibold text-primary-foreground">{initial}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{shown}</span>
                {access ? (
                  <span className="truncate text-xs text-muted-foreground">{access.badge}</span>
                ) : (
                  <span className="truncate text-xs text-muted-foreground">{email}</span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
            <DropdownMenuLabel className="font-normal">
              <p className="m-0 truncate text-sm font-medium">{shown}</p>
              {shown !== email && <p className="m-0 truncate text-xs text-muted-foreground">{email}</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/account" onClick={close}>
                  <Settings /> Hesabım
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/plans" onClick={close}>
                  <CreditCard /> Paketler
                  {access && <span className="ml-auto text-xs text-muted-foreground">{access.badge}</span>}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {theme === "dark" ? <Moon /> : theme === "system" ? <Monitor /> : <Sun />} Tema
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={theme ?? "light"} onValueChange={setTheme}>
                    <DropdownMenuRadioItem value="light">Açık</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">Koyu</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">Sistem</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/privacy" onClick={close}>
                <ShieldCheck /> KVKK aydınlatma metni
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/terms" onClick={close}>
                <FileText /> Kullanım koşulları
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/refund" onClick={close}>
                <ReceiptText /> İade ve cayma
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await signOut()
                window.location.href = "/"
              }}
            >
              <LogOut /> Çıkış yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
