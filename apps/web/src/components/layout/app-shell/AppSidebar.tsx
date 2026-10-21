"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Gauge, Lock, LogIn, Plus } from "lucide-react"
import { Logo } from "@/components/layout/Logo"
import { NAV_GROUPS, NEW_ANALYSIS, isActive } from "@/components/layout/app-shell/navigation"
import { NavUser } from "@/components/layout/app-shell/NavUser"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { useApplicationCards } from "@/features/applications/api"
import { useBillingStatus } from "@/features/billing/api"
import { useSession } from "@/lib/authClient"
import { loginPath } from "@/lib/returnPath"

/**
 * Uygulama kabuğunun kenar çubuğu (DOG-144): shadcn `sidebar-07` deseni.
 * Masaüstünde simgelere daralıyor (Ctrl/⌘+B), mobilde Sheet.
 *
 * Anonim oturum: yalnızca Yeni analiz açık; diğer ögeler kilitli ve kayda
 * götürüyor. Anonim oturum "giriş yapılmış" sayılmıyor (Navbar ile aynı kural).
 */
export function AppSidebar() {
  const path = usePathname()
  const { data, isPending } = useSession()
  const { setOpenMobile } = useSidebar()
  const user = data?.user as { name?: string | null; email?: string; isAnonymous?: boolean | null } | undefined
  const registered = !isPending && !!user && !user.isAnonymous
  const billing = useBillingStatus({ enabled: registered })
  const cards = useApplicationCards({ enabled: registered })
  const interviews = (cards.data ?? []).filter((c) => c.stage === "interview").length
  const close = () => setOpenMobile(false)

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex h-10 items-center px-2 group-data-[collapsible=icon]:hidden">
              <Logo href={registered ? "/dashboard" : "/"} />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={NEW_ANALYSIS.label}
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
            >
              <Link href={NEW_ANALYSIS.href} onClick={close}>
                <Plus />
                <span>{NEW_ANALYSIS.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  // Oturum yüklenirken kilit gösterilmiyor; kayıtlı kullanıcıda
                  // her sayfa açılışında kilitler bir an yanıp sönüyordu.
                  const locked = item.registered && !isPending && !registered
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={!locked && isActive(path, item.href)}
                        tooltip={locked ? `${item.label} · kayıt olunca açılır` : item.label}
                        className={locked ? "text-muted-foreground" : undefined}
                      >
                        <Link href={locked ? loginPath(item.href) : item.href} onClick={close}>
                          <item.icon />
                          <span>{item.label}</span>
                          {locked && <Lock className="ml-auto size-3.5" aria-label="Kayıt olunca açılır" />}
                        </Link>
                      </SidebarMenuButton>
                      {!locked && item.href === "/interviews" && interviews > 0 && (
                        <SidebarMenuBadge aria-label={`${interviews} başvuru mülakat aşamasında`}>{interviews}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {billing.data?.unlimited && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive(path, "/admin")} tooltip="Yönetim">
                    <Link href="/admin" onClick={close}>
                      <Gauge />
                      <span>Yönetim</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {isPending ? (
          // Sabit iskelet: SidebarMenuSkeleton rastgele genişlikle hydration uyuşmazlığı veriyor.
          <Skeleton className="h-12 w-full rounded-lg" />
        ) : registered && user?.email ? (
          <NavUser name={user.name ?? null} email={user.email} />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Giriş yap ya da kayıt ol">
                <Link href={loginPath(path)} onClick={close}>
                  <LogIn />
                  <span>Giriş yap ya da kayıt ol</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
