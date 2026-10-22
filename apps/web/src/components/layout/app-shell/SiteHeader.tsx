"use client"

import { Fragment, Suspense } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { breadcrumbs } from "@/components/layout/app-shell/navigation"
import { PageActionsSlot, usePageCrumb } from "@/components/layout/app-shell/PageActions"
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
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-4 backdrop-blur-md">
      <SidebarTrigger className="-ml-1" aria-label="Kenar çubuğunu aç ya da kapat" />
      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
      {/* useSearchParams statik çizimde Suspense istiyor. */}
      <Suspense fallback={null}>
        <Crumbs />
      </Suspense>
      <PageActionsSlot className="ml-auto flex items-center gap-2" />
    </header>
  )
}

function Crumbs() {
  const path = breadcrumbs(usePathname(), useSearchParams())
  const last = usePageCrumb()
  const crumbs = last && path.length > 1 ? [...path.slice(0, -1), { label: last }] : path
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        {crumbs.map((c, i) => (
          <Fragment key={`${c.label}-${i}`}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem className="min-w-0">
              {c.href ? (
                <BreadcrumbLink asChild>
                  <Link href={c.href}>{c.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
