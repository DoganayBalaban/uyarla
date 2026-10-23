"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ChevronDown, CircleHelp, ExternalLink, FilePlus2, FileText, LoaderCircle, Pencil, Puzzle, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useApplicationCards } from "@/features/applications/api"
import { MAX_AUDIT_POSTINGS } from "@/features/linkedin/audit"
import { useLibrary } from "@/features/resumes/api"
import { cn } from "@/lib/cn"

/** Kullanıcının kendi profili; LinkedIn `/in/me/`'yi sahibinin profiline yönlendiriyor. */
const OWN_PROFILE_URL = "https://www.linkedin.com/in/me/"
/** Chrome Web Mağazası sayfası; eklenti yayımlanınca ortamdan geliyor. */
const EXTENSION_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || null

const roleSchema = z.object({ role: z.string().trim().min(2, "Hedef rolünü yaz.").max(120, "En fazla 120 karakter.") })

/**
 * LinkedIn denetiminin başlangıcı (DOG-157, spec §5.1): hedef rol, isteğe
 * bağlı ilanlar ve iki yol (eklenti önerilen, PDF).
 */
export function AuditStart({
  targetRole,
  extension,
  busy,
  error,
  onStart,
  onTargetRoleSave,
}: {
  targetRole: string | null
  /** null: eklenti yolu gösterilmiyor (durum bilinmiyor ya da kurulamıyor). */
  extension: { installed: boolean } | null
  busy: boolean
  error: string | null
  onStart: (body: { resumeId: string; targetRole: string | null; analysisIds: string[] }) => void
  onTargetRoleSave: (role: string) => Promise<void>
}) {
  const library = useLibrary(true)
  const cards = useApplicationCards()
  const resumes = library.data ?? []
  const [resumeId, setResumeId] = useState<string | null>(null)
  const chosen = resumeId ?? resumes.find((r) => /linkedin/i.test(`${r.label ?? ""} ${r.fileName ?? ""}`))?.id ?? resumes[0]?.id ?? null
  const [picked, setPicked] = useState<string[]>([])
  const [editing, setEditing] = useState(false)
  const form = useForm<z.input<typeof roleSchema>>({ resolver: zodResolver(roleSchema), values: { role: targetRole ?? "" } })
  const analyses = (cards.data ?? []).slice(0, 20)

  const saveRole = form.handleSubmit(async ({ role }) => {
    await onTargetRoleSave(role.trim())
    setEditing(false)
  })

  return (
    <div className="space-y-6">
      <Card className="gap-3 py-5 shadow-xs">
        <CardContent className="space-y-4 px-5">
          {editing || !targetRole ? (
            <form onSubmit={saveRole} className="flex flex-wrap items-end gap-2" noValidate>
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="hedefRol">Hedef rolün</Label>
                <Input id="hedefRol" placeholder="Örneğin: Dijital Pazarlama Uzmanı" {...form.register("role")} />
              </div>
              <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
                Kaydet
              </Button>
              {!targetRole && <p className="m-0 w-full text-xs text-muted-foreground">Hedef rolünü yaz; başlığına ona göre de bakalım.</p>}
              {form.formState.errors.role && (
                <p role="alert" className="m-0 w-full text-sm text-brand-amber">
                  {form.formState.errors.role.message}
                </p>
              )}
            </form>
          ) : (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Hedef rolün:</span>
              <span className="font-medium">{targetRole}</span>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(true)}>
                <Pencil aria-hidden /> değiştir
              </Button>
            </p>
          )}

          {analyses.length > 0 && (
            <details className="group">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary">
                İlanlarıma göre de bak ({picked.length}/{MAX_AUDIT_POSTINGS})
                <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
              </summary>
              <ul className="m-0 mt-3 grid list-none gap-2 p-0 sm:grid-cols-2">
                {analyses.map((c) => {
                  const checked = picked.includes(c.analysisId)
                  const disabled = !checked && picked.length >= MAX_AUDIT_POSTINGS
                  return (
                    <li key={c.analysisId}>
                      <Label
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal transition-colors",
                          checked ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50",
                          disabled && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => setPicked((p) => (checked ? p.filter((x) => x !== c.analysisId) : [...p, c.analysisId]))}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.position}</span>
                          {c.company && <span className="block truncate text-xs text-muted-foreground">{c.company}</span>}
                        </span>
                      </Label>
                    </li>
                  )
                })}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      <div className={cn("grid gap-4", extension && "sm:grid-cols-2")}>
        {extension && (
          <Card className="gap-3 border-primary/40 py-5 shadow-xs">
            <CardHeader className="px-5">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Puzzle className="size-4 text-primary" aria-hidden /> Eklentiyle tek tıkla
                </CardTitle>
                <Badge>Önerilen</Badge>
              </div>
              <CardDescription>Bütün bölümler tek tıkla gelir. Yalnızca kendi profilini okur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-5">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>LinkedIn'de kendi profilini aç.</li>
                <li>Tarayıcının sağ üstündeki uyarla simgesine tıkla.</li>
              </ol>
              {extension.installed ? (
                <Button asChild>
                  <a href={OWN_PROFILE_URL} target="_blank" rel="noreferrer">
                    Profilimi aç <ExternalLink aria-hidden />
                  </a>
                </Button>
              ) : EXTENSION_STORE_URL ? (
                <Button asChild variant="outline">
                  <a href={EXTENSION_STORE_URL} target="_blank" rel="noreferrer">
                    Eklentiyi kur <ExternalLink aria-hidden />
                  </a>
                </Button>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">Eklentiyi kur: Chrome Web Mağazası'nda yayımlanınca bağlantısı burada olacak.</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="gap-3 py-5 shadow-xs">
          <CardHeader className="px-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-primary" aria-hidden /> PDF yükle
            </CardTitle>
            <CardDescription>LinkedIn'den indirdiğin profil PDF'i. Telefonda da çalışır.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-5">
            <details className="group text-sm">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1 font-medium text-primary">
                <CircleHelp className="size-4" aria-hidden /> LinkedIn'den PDF nasıl indirilir?
                <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
              </summary>
              <ol className="mt-2 mb-0 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>LinkedIn'de kendi profil sayfanı aç.</li>
                <li>
                  Profil başlığının altındaki <span className="font-medium text-foreground">Daha fazla</span> düğmesine bas.
                </li>
                <li>
                  <span className="font-medium text-foreground">PDF olarak kaydet</span>&apos;i seç ve dosyayı CV&apos;lerim&apos;e yükle.
                </li>
              </ol>
            </details>
            {resumes.length > 0 ? (
              <Select value={chosen ?? ""} onValueChange={setResumeId}>
                <SelectTrigger aria-label="LinkedIn PDF'in" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label || r.fileName || "CV"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              !library.isPending && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/cvs?ekle=1">
                    <FilePlus2 aria-hidden /> CV'lerim'e yükle
                  </Link>
                </Button>
              )
            )}
            <Button type="button" disabled={!chosen || busy} onClick={() => chosen && onStart({ resumeId: chosen, targetRole, analysisIds: picked })}>
              {busy ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              Profilimi denetle
            </Button>
          </CardContent>
        </Card>
      </div>
      {error && (
        <p role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
