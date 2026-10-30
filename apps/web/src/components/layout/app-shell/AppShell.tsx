import { cookies } from "next/headers"
import { AppSidebar } from "@/components/layout/app-shell/AppSidebar"
import { PageActionsProvider } from "@/components/layout/app-shell/PageActions"
import { SiteHeader } from "@/components/layout/app-shell/SiteHeader"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TrialBanner } from "@/features/billing/components/TrialBanner"

/**
 * Kayıtlı kullanıcının kabuğu: kenar çubuğu, üst çubuk ve içerik (DOG-144).
 * Uygulama ekranları ve yasal sayfalar paylaşıyor. Kenar çubuğunun açık/kapalı
 * seçimi çerezde; sunucu ilk çizimde doğru hâliyle veriyor, sayfa yüklenince
 * zıplamıyor.
 */
export async function AppShell({ before, children }: { before?: React.ReactNode; children: React.ReactNode }) {
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      {before}
      <AppSidebar />
      <SidebarInset>
        <PageActionsProvider>
          {/* Denemedeyse ne zaman ne çekileceği her sayfada (DOG-158). */}
          <TrialBanner />
          <SiteHeader />
          {children}
        </PageActionsProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}
