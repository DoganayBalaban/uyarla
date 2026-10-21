"use client"

import { createContext, useContext, useState } from "react"
import { createPortal } from "react-dom"

/**
 * Üst çubuğun sağındaki sayfaya özel eylem alanı (DOG-144). SiteHeader alanı
 * açıyor, sayfa `<PageActions>` ile dolduruyor; sayfa değişince içerik de
 * kendiliğinden gidiyor.
 */
const SlotContext = createContext<{ slot: HTMLElement | null; setSlot: (el: HTMLElement | null) => void } | null>(null)

export function PageActionsProvider({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  return <SlotContext.Provider value={{ slot, setSlot }}>{children}</SlotContext.Provider>
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
