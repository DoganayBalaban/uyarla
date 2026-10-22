"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createPortal } from "react-dom"

/**
 * Üst çubuğun sayfaya bağlı parçaları (DOG-144): sağdaki eylem alanı ve konum
 * yolunun son ögesi. SiteHeader alanı açıyor, sayfa `<PageActions>` ve
 * `<PageCrumb>` ile dolduruyor; sayfa değişince içerik de kendiliğinden gidiyor.
 */
interface HeaderContext {
  slot: HTMLElement | null
  setSlot: (el: HTMLElement | null) => void
  crumb: string | null
  setCrumb: (label: string | null) => void
}

const SlotContext = createContext<HeaderContext | null>(null)

export function PageActionsProvider({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [crumb, setCrumb] = useState<string | null>(null)
  return <SlotContext.Provider value={{ slot, setSlot, crumb, setCrumb }}>{children}</SlotContext.Provider>
}

/** SiteHeader'ın eylem alanı. */
export function PageActionsSlot({ className }: { className?: string }) {
  const ctx = useContext(SlotContext)
  return <div ref={ctx?.setSlot} className={className} />
}

/** Sayfanın üst çubuğa koyduğu eylemler; kabuk dışında hiçbir şey çizmiyor. */
export function PageActions({ children }: { children: React.ReactNode }) {
  const slot = useContext(SlotContext)?.slot
  return slot ? createPortal(children, slot) : null
}

/**
 * Konum yolunun son ögesini veriden adlandırır (DOG-152): "Mülakatlar ›
 * Frontend Geliştirici". Yolun kendisi adresten; yalnızca son etiket burada.
 */
export function PageCrumb({ label }: { label: string }) {
  const setCrumb = useContext(SlotContext)?.setCrumb
  useEffect(() => {
    setCrumb?.(label)
    return () => setCrumb?.(null)
  }, [label, setCrumb])
  return null
}

/** SiteHeader için: sayfanın verdiği son etiket. */
export function usePageCrumb(): string | null {
  return useContext(SlotContext)?.crumb ?? null
}
