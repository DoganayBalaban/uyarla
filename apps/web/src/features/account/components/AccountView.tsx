"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { CircleCheck, CreditCard, Database, Download, FileText, LoaderCircle, Mail, SlidersHorizontal, Trash2, UserRound } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { AppPageHeader } from "@/components/layout/app-shell/AppPage"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/lib/authClient"
import { apiErrorMessage } from "@/lib/api"
import { loginPath } from "@/lib/returnPath"
import { useDeleteAccount } from "@/features/account/api"
import { ProfileSection } from "@/features/account/components/ProfileSection"
import { ExcludedConceptsSection } from "@/features/account/components/ExcludedConceptsSection"
import { NotificationsSection } from "@/features/account/components/NotificationsSection"
import { AccessStatus } from "@/features/billing/components/AccessStatus"

/** Marka rehberi §10.2'deki veri silme onay metni, birebir. */
const CONFIRM_TEXT = "CV'ni ve tüm başvurularını kalıcı olarak silmek istediğine emin misin?"
/** Silme yazarak onaylanıyor (DOG-153): yanlışlıkla basılan düğme yetmesin. */
const CONFIRM_WORD = "SİL"

type Section = "profil" | "abonelik" | "tercihler" | "veriler"

const SECTIONS: Array<{ id: Section; label: string; Icon: typeof UserRound; registered: boolean }> = [
  { id: "profil", label: "Profil", Icon: UserRound, registered: true },
  { id: "abonelik", label: "Abonelik", Icon: CreditCard, registered: true },
  { id: "tercihler", label: "Tercihler", Icon: SlidersHorizontal, registered: true },
  { id: "veriler", label: "Veriler", Icon: Database, registered: false },
]

const isSection = (v: string): v is Section => SECTIONS.some((s) => s.id === v)

/**
 * Hesabım (DOG-153): ayar düzeni; geniş ekranda solda dikey sekmeler, dar
 * ekranda üstte. Sekme adreste (#profil…) ki bağlantıyla açılabilsin. CV
 * kütüphanesi ve anlattığın deneyimler /cvs'te (DOG-149).
 */
export function AccountView() {
  const { data, isPending, refetch } = useSession()
  const [deleted, setDeleted] = useState(false)
  const [section, setSection] = useState<Section>("profil")
  // İlk çizim sunucuyla aynı olsun: sunucu oturumu bilmiyor; oturum hazır
  // gelince sekmeler değişiyor ve Radix kimlikleri kayıyordu (DOG-146'daki gibi).
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const currentUser = hydrated ? data?.user : undefined
  const registered = !!currentUser && !(currentUser as { isAnonymous?: boolean | null }).isAnonymous
  const shown = SECTIONS.filter((s) => registered || !s.registered)
  const active = shown.some((s) => s.id === section) ? section : (shown[0]?.id ?? "veriler")

  useEffect(() => {
    const read = () => {
      const hash = window.location.hash.slice(1)
      if (isSection(hash)) setSection(hash)
    }
    read()
    window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
  }, [])

  function choose(next: string) {
    if (!isSection(next)) return
    setSection(next)
    window.history.replaceState(null, "", `#${next}`)
  }

  if (deleted) {
    return (
      <Card className="mx-auto max-w-md items-center py-10 text-center">
        <CardContent className="flex flex-col items-center">
          <span className="grid size-12 place-items-center rounded-full bg-brand-green/10 text-brand-green dark:text-[#4ade80]">
            <CircleCheck className="size-6" aria-hidden />
          </span>
          <h1 className="m-0 mt-4 text-xl font-semibold">Hesabın silindi</h1>
          <p className="m-0 mt-2 text-sm text-muted-foreground">
            CV&apos;n, ilanların ve analizlerin kalıcı olarak silindi. Bir gün yine iş arıyorsan buradayız.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Ana sayfaya dön</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (hydrated && !isPending && !currentUser) {
    return (
      <Card className="mx-auto max-w-md items-center py-10 text-center">
        <CardContent className="flex flex-col items-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <UserRound className="size-6" aria-hidden />
          </span>
          <h1 className="m-0 mt-4 text-xl font-semibold">Hesabım</h1>
          <p className="m-0 mt-2 text-sm text-muted-foreground">Devam etmek için giriş yapman gerekiyor.</p>
          <Button asChild className="mt-6">
            <Link href={loginPath("/account")}>Giriş yap</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <AppPageHeader
        title="Hesabım"
        description={
          registered ? (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden />
              {currentUser?.email}
            </span>
          ) : (
            // Anonim oturumun e-postası bir yer tutucu; göstermek kafa karıştırırdı.
            "Kayıtsız oturum. Verilerini buradan silebilirsin."
          )
        }
      />
      <Tabs value={active} onValueChange={choose} className="gap-6 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-start">
        <TabsList
          aria-label="Hesap ayarları"
          className="w-full justify-start overflow-x-auto [scrollbar-width:none] lg:sticky lg:top-20 lg:h-auto! lg:flex-col lg:items-stretch lg:bg-transparent lg:p-0 [&::-webkit-scrollbar]:hidden"
        >
          {shown.map(({ id, label, Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="px-3 lg:justify-start lg:py-2 lg:data-[state=active]:bg-muted lg:data-[state=active]:shadow-none"
            >
              <Icon aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* İçerikler hep takılı (gizli sekme saklı): kaydedilmemiş form değişiklikleri sekme değişince kaybolmasın. */}
        <div className="min-w-0">
          {registered && (
            <>
              <TabsContent value="profil" forceMount className="data-[state=inactive]:hidden">
                <ProfileSection />
              </TabsContent>
              <TabsContent value="abonelik" forceMount className="space-y-4 data-[state=inactive]:hidden">
                <Card className="shadow-xs">
                  <CardHeader>
                    <CardTitle className="text-base">Abonelik</CardTitle>
                    <CardDescription>Paketin, deneme ya da sonraki ödeme tarihi; ücretsizde bu ayki hakların. İptal ve kart değişikliği &quot;Aboneliği yönet&quot;te.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AccessStatus className="border-0 bg-transparent p-0" />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="tercihler" forceMount className="space-y-4 data-[state=inactive]:hidden">
                <ThemeSection />
                <NotificationsSection />
                <ExcludedConceptsSection />
              </TabsContent>
            </>
          )}
          <TabsContent value="veriler" forceMount className="space-y-4 data-[state=inactive]:hidden">
            <DataSection
              onDeleted={() => {
                setDeleted(true)
                void refetch()
              }}
              registered={registered}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function ThemeSection() {
  const { theme, setTheme } = useTheme()
  // Tema istemcide; ilk çizim sunucuyla aynı olsun.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle className="text-base">Görünüm</CardTitle>
        <CardDescription>Sistem, cihazının açık ya da koyu ayarını izler.</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={mounted ? (theme ?? "light") : "light"} onValueChange={setTheme} aria-label="Tema" className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["light", "Açık"],
              ["dark", "Koyu"],
              ["system", "Sistem"],
            ] as const
          ).map(([value, label]) => (
            <Label
              key={value}
              htmlFor={`tema-${value}`}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
            >
              <RadioGroupItem id={`tema-${value}`} value={value} />
              {label}
            </Label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}

function DataSection({ onDeleted, registered }: { onDeleted: () => void; registered: boolean }) {
  const removeAccount = useDeleteAccount()
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const confirmed = typed.trim().toLocaleUpperCase("tr-TR") === CONFIRM_WORD

  async function deleteAccount() {
    setError(null)
    try {
      await removeAccount.mutateAsync()
      // Oturum sunucuda silindi ama istemcideki oturum deposu eski hâlinde
      // kalıyordu: üst menüde silinen hesabın adı görünüyordu (DOG-74).
      // Önbellekteki kullanıcı verisi (kütüphane, pano) de bırakılmıyor.
      queryClient.clear()
      onDeleted()
    } catch (e) {
      setError(await apiErrorMessage(e, "Hesabını silemedik. Birazdan tekrar dener misin?"))
    }
  }

  return (
    <>
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">Verilerin</CardTitle>
          <CardDescription>
            KVKK md. 11 kapsamında bütün verin tek ZIP dosyasında: CV&apos;lerin, analizlerin, uyarlamaların.{" "}
            <Link href="/privacy" className="font-medium text-primary">
              KVKK aydınlatma metni
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {/* Düz bağlantı: tarayıcı indirmeyi kendisi yönetiyor, istemci kodu gerekmiyor (DOG-63). */}
          <Button asChild variant="outline">
            <a href="/api/account" download>
              <Download aria-hidden />
              Verilerimi indir
            </a>
          </Button>
          {registered && (
            <Button asChild variant="ghost">
              <Link href="/cvs">
                <FileText aria-hidden />
                CV&apos;lerim
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/30 shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="size-4 text-destructive" aria-hidden />
            Verilerini sil
          </CardTitle>
          <CardDescription>CV&apos;n, yapıştırdığın ilanlar, analizlerin ve uyarlamaların silinir. Geri alınamaz.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) {
                setTyped("")
                setError(null)
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/5 hover:text-destructive">
                Hesabımı ve verilerimi sil
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{CONFIRM_TEXT}</AlertDialogTitle>
                <AlertDialogDescription>Bu işlem geri alınamaz. Onaylamak için kutuya {CONFIRM_WORD} yaz.</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="sil-onay" className="sr-only">
                  Onay
                </Label>
                <Input id="sil-onay" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={CONFIRM_WORD} autoComplete="off" />
                {error && (
                  <p role="alert" className="m-0 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={removeAccount.isPending}>Vazgeç</AlertDialogCancel>
                {/* Kendi düğmemiz: AlertDialogAction tıklayınca kapanıyor, hata gösterilemiyordu. */}
                <Button
                  type="button"
                  className="bg-destructive text-white hover:bg-destructive/90"
                  disabled={!confirmed || removeAccount.isPending}
                  onClick={() => void deleteAccount()}
                >
                  {removeAccount.isPending && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
                  {removeAccount.isPending ? "Siliniyor…" : "Evet, kalıcı olarak sil"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </>
  )
}
