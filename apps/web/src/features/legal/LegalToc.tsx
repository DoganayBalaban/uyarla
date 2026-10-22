"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/cn"

/** "1. Veri sorumlusu" → "1-veri-sorumlusu"; Türkçe harfler sadeleşiyor. */
export function slugify(text: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => map[c] ?? c)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

/**
 * Yasal sayfaların "Bu sayfada" listesi (DOG-156). Metinler değişmesin diye
 * başlıklar sayfadaki h2'lerden okunuyor; kimliği olmayan başlığa kimlik
 * veriliyor. Okunan bölüm vurgulu.
 */
export function LegalToc({ containerId }: { containerId: string }) {
  const [items, setItems] = useState<Array<{ id: string; text: string }>>([])
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const root = document.getElementById(containerId)
    if (!root) return
    const headings = [...root.querySelectorAll("h2")]
    headings.forEach((h) => {
      if (!h.id) h.id = slugify(h.textContent ?? "")
      h.classList.add("scroll-mt-24")
    })
    setItems(headings.map((h) => ({ id: h.id, text: h.textContent ?? "" })))
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-80px 0px -70% 0px" },
    )
    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [containerId])

  if (items.length < 2) return null
  return (
    <nav aria-label="Bu sayfada" className="sticky top-24 hidden text-sm lg:block">
      <p className="m-0 mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Bu sayfada</p>
      <ul className="m-0 list-none space-y-1 border-l p-0">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 py-1 pl-3 no-underline transition-colors",
                active === item.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
