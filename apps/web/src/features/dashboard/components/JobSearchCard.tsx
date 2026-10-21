"use client"

import Link from "next/link"
import { useState } from "react"
import { ExternalLink, Search } from "lucide-react"
import { searchLinks } from "@uyarla/core/jobSuggest/links"
import { useSaveProfile } from "@/features/account/api"

/**
 * "İlan bul" (DOG-68): profilden kurulan sorguyla sitelerin kendi arama
 * sayfaları. API, kazıma ve ilan saklama yok. Rol kaydediliyor (hedef rol);
 * şehir yalnızca bu bağlantılar için, saklanmıyor.
 */
export function JobSearchCard({ initialKeywords }: { initialKeywords: string }) {
  const [keywords, setKeywords] = useState(initialKeywords)
  const [city, setCity] = useState("")
  const [saved, setSaved] = useState(false)
  const save = useSaveProfile()
  const links = searchLinks({ keywords, city })
  const changed = keywords.trim() !== initialKeywords.trim()

  async function saveRole() {
    setSaved(false)
    try {
      await save.mutateAsync({ targetRole: keywords.trim() || null })
      setSaved(true)
    } catch {
      // Kaydedilemese de bağlantılar yazılan rolle çalışıyor.
    }
  }

  return (
    <section aria-labelledby="ilan-bul" className="rounded-card border border-border bg-card p-5">
      <h2 id="ilan-bul" className="m-0 flex items-center gap-2 text-base font-bold">
        <Search className="size-4 text-brand-blue" aria-hidden />
        İlan bul
      </h2>
      <div className="mt-3 space-y-2 text-sm">
        <label className="block">
          <span className="text-muted-foreground">Rol</span>
          <input
            value={keywords}
            onChange={(e) => {
              setKeywords(e.target.value)
              setSaved(false)
            }}
            maxLength={80}
            placeholder="Örn. Muhasebe Uzmanı"
            className="mt-1 w-full rounded-button border border-border bg-background px-2 py-1.5"
          />
        </label>
        {changed && keywords.trim() && (
          <button type="button" onClick={() => void saveRole()} disabled={save.isPending} className="font-semibold text-brand-blue disabled:opacity-50">
            Hedef rolüm olarak kaydet
          </button>
        )}
        {saved && <p className="m-0 text-xs text-muted-foreground">Hedef rolün güncellendi.</p>}
        <label className="block">
          <span className="text-muted-foreground">Şehir (isteğe bağlı)</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={40}
            placeholder="Tüm Türkiye"
            className="mt-1 w-full rounded-button border border-border bg-background px-2 py-1.5"
          />
        </label>
      </div>
      {links.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {links.map((l) => (
            <li key={l.site}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-1 rounded-button border border-border px-3 py-2 font-medium no-underline hover:border-brand-blue/40"
              >
                {l.label}
                <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Aramak istediğin rolü yaz.</p>
      )}
      <p className="m-0 mt-3 text-sm text-muted-foreground">
        Beğendiğin ilanın bağlantısını ya da metnini{" "}
        <Link href="/analyze" className="font-medium text-brand-blue">
          yapıştır
        </Link>
        , uyumunu hemen ölçelim.
      </p>
      <p className="m-0 mt-2 text-sm text-muted-foreground">
        <Link href="/linkedin" className="font-medium text-brand-blue">
          LinkedIn profilini
        </Link>{" "}
        de hedef ilanlarla karşılaştırabilirsin.
      </p>
    </section>
  )
}
