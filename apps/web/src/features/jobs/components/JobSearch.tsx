"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Check, ExternalLink, Link2, MapPin, Plus, Search, Sparkles } from "lucide-react"
import { searchLinks, type SearchSite } from "@uyarla/core/jobSuggest/links"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSaveProfile } from "@/features/account/api"
import type { SkillGap } from "@/features/dashboard/skillGaps"
import { addTerm } from "@/features/jobs/suggestions"
import { jobUrlSchema } from "@/features/analysis/schema"

/** Her sitenin ne aradığı; bağlantı kurallarıyla aynı (jobSuggest/links). */
const SITE_NOTE: Record<SearchSite, (city: string | null) => string> = {
  kariyernet: () => "Şehri sitede seçersin",
  linkedin: (city) => (city ? `${city}, Türkiye` : "Tüm Türkiye"),
  jooble: (city) => city ?? "Tüm Türkiye",
  careerjet: (city) => city ?? "Tüm Türkiye",
}

/** Uzaktan ve hibrit, sitelerde arama terimi olarak en geniş sonucu veriyor. */
const WORK_MODES = ["uzaktan", "hibrit"]

/**
 * İş ara (DOG-150): profilden kurulan sorguyla sitelerin kendi arama
 * sayfaları (DOG-68). API, kazıma ve ilan saklama yok; bağlantılar yeni
 * sekmede. Rol hedef rol olarak kaydedilebiliyor; şehir saklanmıyor.
 */
export function JobSearch({
  initialKeywords,
  roles,
  skills,
  gaps,
}: {
  initialKeywords: string
  roles: string[]
  skills: string[]
  gaps: SkillGap[]
}) {
  const router = useRouter()
  const reducedMotion = useReducedMotion() ?? false
  const [keywords, setKeywords] = useState(initialKeywords)
  const [savedRole, setSavedRole] = useState(initialKeywords)
  const [city, setCity] = useState("")
  const [postingUrl, setPostingUrl] = useState("")
  const save = useSaveProfile()
  const links = searchLinks({ keywords, city })
  const trimmedCity = city.trim() || null
  const lower = keywords.toLocaleLowerCase("tr-TR")
  const has = (term: string) => lower.includes(term.toLocaleLowerCase("tr-TR"))
  const validUrl = jobUrlSchema.safeParse({ url: postingUrl }).success

  async function saveRole() {
    try {
      await save.mutateAsync({ targetRole: keywords.trim() || null })
      setSavedRole(keywords.trim())
    } catch {
      // Kaydedilemese de bağlantılar yazılan rolle çalışıyor.
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <Card className="gap-4 shadow-xs lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="size-4 text-primary" aria-hidden />
            Ne arıyorsun?
          </CardTitle>
          <CardDescription>Kısa sorgu daha çok sonuç getirir: bir rol, gerekirse bir beceri.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="is-rol">Anahtar kelimeler</Label>
            <Input id="is-rol" value={keywords} onChange={(e) => setKeywords(e.target.value)} maxLength={80} placeholder="Örn. Muhasebe Uzmanı" />
            {keywords.trim() && keywords.trim() !== savedRole.trim() && (
              <Button type="button" variant="link" size="sm" className="h-auto px-0" disabled={save.isPending} onClick={() => void saveRole()}>
                Hedef rolüm olarak kaydet
              </Button>
            )}
            {save.isSuccess && keywords.trim() === savedRole.trim() && (
              <p className="m-0 flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="size-3.5" aria-hidden /> Hedef rolün güncellendi.
              </p>
            )}
          </div>

          {roles.length > 0 && (
            <div>
              <p className="m-0 text-xs font-medium text-muted-foreground">Roller · aramanın yerine geçer</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <SuggestionBadge key={r} active={keywords.trim().toLocaleLowerCase("tr-TR") === r.toLocaleLowerCase("tr-TR")} onClick={() => setKeywords(r)}>
                    {r}
                  </SuggestionBadge>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="m-0 text-xs font-medium text-muted-foreground">Aramana ekle</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[...skills, ...WORK_MODES].map((t) => (
                <SuggestionBadge key={t} active={has(t)} add onClick={() => setKeywords((k) => addTerm(k, t))}>
                  {t}
                </SuggestionBadge>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="is-sehir">Şehir</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="is-sehir" value={city} onChange={(e) => setCity(e.target.value)} maxLength={40} placeholder="Tüm Türkiye" className="pl-8" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-6">
        <section aria-labelledby="platformlar">
          <h2 id="platformlar" className="m-0 text-base font-semibold">
            Sitelerde ara
          </h2>
          {links.length > 0 ? (
            <ul className="m-0 mt-3 grid list-none gap-3 p-0 sm:grid-cols-2">
              {links.map((l, i) => (
                <motion.li
                  key={l.site}
                  initial={reducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: reducedMotion ? 0 : i * 0.04 }}
                >
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex h-full items-start gap-3 rounded-xl border bg-card p-4 no-underline shadow-xs transition hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-foreground">{l.label}</span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">
                        &ldquo;{keywords.trim()}&rdquo; · {SITE_NOTE[l.site](trimmedCity)}
                      </span>
                    </span>
                    <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground transition group-hover:text-primary" aria-hidden />
                    <span className="sr-only">(yeni sekmede açılır)</span>
                  </a>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="m-0 mt-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aramak istediğin rolü yaz; sitelerin arama sayfaları burada açılır.
            </p>
          )}
        </section>

        <Card className="gap-3 border-primary/20 bg-primary/5 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">İlanı bulunca</CardTitle>
            <CardDescription>Bağlantıyı yapıştır, ilanı biz getirelim; uyumunu hemen ölçelim.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault()
                router.push(validUrl ? `/analyze?ilan=${encodeURIComponent(postingUrl.trim())}` : "/analyze")
              }}
            >
              <div className="relative min-w-0 flex-1">
                <Link2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  type="url"
                  inputMode="url"
                  value={postingUrl}
                  onChange={(e) => setPostingUrl(e.target.value)}
                  placeholder="https://www.kariyer.net/is-ilani/…"
                  aria-label="İlan bağlantısı"
                  className="bg-background pl-8"
                />
              </div>
              <Button type="submit">
                {validUrl ? "İlanı getir ve analiz et" : "Metni yapıştır"}
                <ArrowRight aria-hidden />
              </Button>
            </form>
          </CardContent>
        </Card>

        {gaps.length > 0 && (
          <Card className="gap-3 shadow-xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-primary" aria-hidden />
                Son analizlerinde sık eksik kalanlar
              </CardTitle>
              <CardDescription>
                Deneyiminde varsa aramana ekle: bu kavramları isteyen ilanlar senin için daha uygun olabilir.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {gaps.map((g) => (
                <SuggestionBadge key={g.term} active={has(g.term)} add onClick={() => setKeywords((k) => addTerm(k, g.term))}>
                  {g.term}
                  <span className="text-muted-foreground tabular-nums">· {g.postings} ilan</span>
                </SuggestionBadge>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function SuggestionBadge({
  children,
  active,
  add = false,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  add?: boolean
  onClick: () => void
}) {
  return (
    <Badge asChild variant={active ? "secondary" : "outline"} className={active ? "bg-primary/10 text-primary" : "font-normal"}>
      <button type="button" onClick={onClick} disabled={active} aria-pressed={active} className="cursor-pointer gap-1 px-2.5 py-1 text-sm disabled:cursor-default">
        {active ? <Check aria-hidden /> : add ? <Plus aria-hidden /> : null}
        {children}
      </button>
    </Badge>
  )
}
