"use client"

import { Fragment } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { breadcrumbs } from "@/components/layout/app-shell/navigation"
import { PageActionsSlot } from "@/components/layout/app-shell/PageActions"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

/**
 * Uygulama kabuğunun üst çubuğu (DOG-144): kenar çubuğu düğmesi ve konum yolu.
 * Sağdaki alanı sayfalar `PageActions` ile dolduruyor.
 */
export function SiteHeader() {
  const crumbs = breadcrumbs(usePathname())
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-4 backdrop-blur-md">
      <SidebarTrigger className="-ml-1" aria-label="Kenar çubuğunu aç ya da kapat" />
      {crumbs.length > 0 && <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />}
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((c, i) => (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {c.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <PageActionsSlot className="ml-auto flex items-center gap-2" />
    </header>
  )
}
