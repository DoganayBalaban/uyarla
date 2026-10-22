"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Clock, CreditCard, FilePlus2, IdCard, Monitor, Moon, Plus, Search, Settings, SquareKanban, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { NAV_GROUPS, NEW_ANALYSIS } from "@/components/layout/app-shell/navigation"
import { RECENT_KEY, parseRecent, pushRecent, type RecentItem } from "@/components/layout/app-shell/recent"
import { useApplicationCards } from "@/features/applications/api"
import { useSession } from "@/lib/authClient"
import { loginPath } from "@/lib/returnPath"

const PAGES = [
  ...NAV_GROUPS.flatMap((g) => g.items),
  { href: "/account", label: "Hesabım", icon: Settings, registered: true },
  { href: "/plans", label: "Paketler", icon: CreditCard, registered: true },
]

function readRecent(): RecentItem[] {
  try {
    return parseRecent(window.localStorage.getItem(RECENT_KEY))
  } catch {
    return []
  }
}

function saveRecent(list: RecentItem[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // Gizli pencere ya da engellenmiş depolama: son açılanlar yalnızca bu oturumda.
  }
}

/**
 * ⌘K komut menüsü (DOG-154): klavyeden her yere. Sayfalar, başvurular
 * (pozisyon ve şirkete göre) ve eylemler. Anonim oturumda yalnızca sayfalar
 * ve yeni analiz; kayıt isteyen sayfalar girişe götürüyor (kenar çubuğuyla aynı).
 */
export function CommandMenu() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<RecentItem[]>([])
  const { data, isPending } = useSession()
  const user = data?.user as { isAnonymous?: boolean | null } | undefined
  const registered = !isPending && !!user && !user.isAnonymous
  const cards = useApplicationCards({ enabled: registered && open })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (open) setRecent(readRecent())
  }, [open])

  const go = useCallback(
    (item: RecentItem) => {
      setOpen(false)
      const next = pushRecent(readRecent(), item)
      saveRecent(next)
      setRecent(next)
      router.push(item.href)
    },
    [router],
  )
  const run = (action: () => void) => {
    setOpen(false)
    action()
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 px-2.5 text-muted-foreground sm:w-48 sm:justify-start lg:w-56"
        aria-label="Ara ya da git (Ctrl+K)"
      >
        <Search aria-hidden />
        <span className="hidden sm:inline">Ara ya da git…</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} showCloseButton={false} title="Komut menüsü" description="Bir sayfaya, başvuruya ya da eyleme git.">
        <CommandInput placeholder={registered ? "Sayfa, başvuru ya da eylem ara…" : "Sayfa ara…"} aria-label="Komut ara" />
        <CommandList>
          <CommandEmpty>Sonuç yok.</CommandEmpty>

          {recent.length > 0 && (
            <>
              <CommandGroup heading="Son açılanlar">
                {recent.map((r) => (
                  <CommandItem key={`son-${r.href}`} value={`son ${r.label} ${r.href}`} onSelect={() => go(r)}>
                    <Clock aria-hidden />
                    {r.label}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Eylemler">
            <CommandItem value="yeni analiz ilan cv karşılaştır" onSelect={() => go({ href: NEW_ANALYSIS.href, label: NEW_ANALYSIS.label })}>
              <Plus aria-hidden />
              Yeni analiz
            </CommandItem>
            {registered && (
              <>
                <CommandItem value="cv ekle yükle kütüphane" onSelect={() => go({ href: "/cvs?ekle=1", label: "CV ekle" })}>
                  <FilePlus2 aria-hidden />
                  CV ekle
                </CommandItem>
                <CommandItem value="linkedin raporu profil" onSelect={() => go({ href: "/linkedin", label: "LinkedIn raporu" })}>
                  <IdCard aria-hidden />
                  LinkedIn raporu
                </CommandItem>
                <CommandItem value="tema açık aydınlık light" onSelect={() => run(() => setTheme("light"))}>
                  <Sun aria-hidden />
                  Açık temaya geç
                </CommandItem>
                <CommandItem value="tema koyu karanlık dark" onSelect={() => run(() => setTheme("dark"))}>
                  <Moon aria-hidden />
                  Koyu temaya geç
                </CommandItem>
                <CommandItem value="tema sistem" onSelect={() => run(() => setTheme("system"))}>
                  <Monitor aria-hidden />
                  Sistem temasını kullan
                </CommandItem>
              </>
            )}
          </CommandGroup>
          <CommandSeparator />

          <CommandGroup heading="Git">
            {PAGES.map((p) => (
              <CommandItem
                key={p.href}
                value={`git ${p.label}`}
                onSelect={() => go({ href: p.registered && !registered ? loginPath(p.href) : p.href, label: p.label })}
              >
                <p.icon aria-hidden />
                {p.label}
                {p.registered && !registered && <CommandShortcut>kayıt</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          {registered && (cards.data?.length ?? 0) > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Başvurular">
                {cards.data!.map((c) => (
                  <CommandItem
                    key={c.analysisId}
                    value={`başvuru ${c.position} ${c.company ?? ""} ${c.analysisId}`}
                    onSelect={() => go({ href: `/applications/${c.analysisId}`, label: c.position })}
                  >
                    <SquareKanban aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      {c.position}
                      {c.company && <span className="text-muted-foreground"> · {c.company}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
