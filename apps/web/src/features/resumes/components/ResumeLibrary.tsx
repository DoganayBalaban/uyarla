"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Ellipsis, FilePlus2, FileText, LoaderCircle, Pencil, Star, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ResumeUpload } from "@/features/analysis/components/ResumeUpload"
import { resumeFileSchema } from "@/features/analysis/schema"
import { STAGE_LABEL, isStage } from "@/features/applications/board"
import { useLibrary, useRemoveResume, useUpdateResume, useUploadResume } from "@/features/resumes/api"
import { isLibraryFull, resumeTitle } from "@/features/resumes/library"
import { LIBRARY_MAX, labelSchema, type LibraryResume } from "@/features/resumes/schema"
import { apiErrorMessage } from "@/lib/api"

const addSchema = z.object({ cv: resumeFileSchema, label: labelSchema })
const renameSchema = z.object({ label: labelSchema })

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" })

/**
 * CV kütüphanesi (DOG-50, DOG-149): kartlar, kart menüsünde temel CV yap,
 * yeniden adlandır ve kaldır; "CV ekle" diyalogda. Her kartta o CV'yle
 * analiz edilen ilanlar (DOG-137) ve "Bu CV'yle analiz et" kısayolu.
 */
export function ResumeLibrary() {
  const library = useLibrary(true)
  const resumes = library.data ?? []
  const full = isLibraryFull(resumes)
  const [adding, setAdding] = useState(false)
  const reducedMotion = useReducedMotion() ?? false
  // Komut menüsündeki "CV ekle" (DOG-154): `?ekle=1` diyaloğu açıyor; sayfa
  // zaten açıkken de (adres değişince) çalışsın diye arama parametresinden.
  const wantsAdd = useSearchParams().get("ekle") === "1"
  useEffect(() => {
    if (!wantsAdd) return
    const url = new URL(window.location.href)
    url.searchParams.delete("ekle")
    window.history.replaceState(null, "", url.pathname + url.search + url.hash)
    setAdding(true)
  }, [wantsAdd])

  return (
    <section aria-labelledby="cv-kutuphanesi">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="cv-kutuphanesi" className="m-0 text-base font-semibold">
            Kütüphane
          </h2>
          <p className="m-0 mt-1 max-w-xl text-sm text-muted-foreground">
            Analizde yeniden yüklemek yerine buradan seçersin; temel CV yeni analizde seçili gelir. Kaldırdığın
            CV&apos;yle yapılmış analizler panoda kalır.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-28" title={`${resumes.length} / ${LIBRARY_MAX} CV`}>
            <Progress value={(resumes.length / LIBRARY_MAX) * 100} aria-label="Kütüphane doluluğu" className="h-1.5" />
            <p className="m-0 mt-1 text-right text-xs text-muted-foreground tabular-nums">
              {resumes.length} / {LIBRARY_MAX}
            </p>
          </div>
          <Button type="button" disabled={full || library.isPending} onClick={() => setAdding(true)}>
            <FilePlus2 aria-hidden />
            CV ekle
          </Button>
        </div>
      </div>
      {full && (
        <p className="m-0 mt-2 text-sm text-muted-foreground">
          En fazla {LIBRARY_MAX} CV kaydedebilirsin. Yeni eklemek için birini kaldır.
        </p>
      )}

      {library.isPending ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <Card className="mt-5 items-center border-dashed py-10 text-center shadow-none">
          <CardContent className="flex flex-col items-center">
            <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <FileText className="size-6" aria-hidden />
            </span>
            <p className="m-0 mt-4 font-semibold">Henüz kayıtlı CV&apos;n yok.</p>
            <p className="m-0 mt-1 max-w-sm text-sm text-muted-foreground">
              Bir kez ekle, her ilanda seç. Analizde yüklediğin dosyayı da &quot;Kütüphaneme kaydet&quot; ile buraya alabilirsin.
            </p>
            <Button type="button" className="mt-5" onClick={() => setAdding(true)}>
              <FilePlus2 aria-hidden />
              İlk CV&apos;ni ekle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="m-0 mt-5 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {resumes.map((resume, i) => (
            <motion.li
              key={resume.id}
              layout={!reducedMotion}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: reducedMotion ? 0 : i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            >
              <ResumeCard resume={resume} />
            </motion.li>
          ))}
        </ul>
      )}

      <AddResumeDialog open={adding} onOpenChange={setAdding} />
    </section>
  )
}

function ResumeCard({ resume }: { resume: LibraryResume }) {
  const update = useUpdateResume()
  const remove = useRemoveResume()
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const title = resumeTitle(resume)

  async function guard(action: () => Promise<unknown>, fallback: string) {
    setError(null)
    try {
      await action()
      return true
    } catch (e) {
      setError(await apiErrorMessage(e, fallback))
      return false
    }
  }

  return (
    <Card className={resume.isDefault ? "h-full gap-4 border-primary/40 shadow-xs" : "h-full gap-4 shadow-xs"}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{title}</CardTitle>
            <CardDescription className="mt-0.5 truncate">
              {resume.label && resume.fileName ? `${resume.fileName} · ` : ""}
              {DATE.format(new Date(resume.createdAt))}
            </CardDescription>
            {resume.isDefault && (
              <Badge className="mt-2 gap-1 bg-brand-amber/15 text-foreground">
                <Star aria-hidden /> Temel CV
              </Badge>
            )}
          </div>
        </div>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label={`${title} işlemleri`}>
                <Ellipsis aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                disabled={resume.isDefault || update.isPending}
                onSelect={() => void guard(() => update.mutateAsync({ id: resume.id, patch: { isDefault: true } }), "Temel CV yapamadık.")}
              >
                <Star aria-hidden /> Temel CV yap
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil aria-hidden /> Yeniden adlandır
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                <Trash2 aria-hidden /> Kaldır
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        <ResumeApplications resume={resume} />
        {error && (
          <p role="alert" className="m-0 mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/analyze?cv=${encodeURIComponent(resume.id)}`}>
            Bu CV&apos;yle analiz et
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardFooter>

      <RenameDialog
        resume={resume}
        open={renaming}
        onOpenChange={setRenaming}
        onSave={(label) => guard(() => update.mutateAsync({ id: resume.id, patch: { label } }), "Adını değiştiremedik.")}
        saving={update.isPending}
      />
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title} kaldırılsın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              Kütüphanenden çıkar. Bu CV&apos;yle yapılmış analizler ve başvurular panoda kalır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() => void guard(() => remove.mutateAsync(resume.id), "Kaldıramadık.")}
            >
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

function RenameDialog({
  resume,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  resume: LibraryResume
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (label: string | null) => Promise<boolean>
  saving: boolean
}) {
  const form = useForm<z.input<typeof renameSchema>, unknown, z.output<typeof renameSchema>>({
    resolver: zodResolver(renameSchema),
    values: { label: resume.label ?? "" },
  })
  const submit = form.handleSubmit(async ({ label }) => {
    if (await onSave(label)) onOpenChange(false)
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeniden adlandır</DialogTitle>
          <DialogDescription>Boş bırakırsan dosya adı görünür.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          <Label htmlFor={`cv-ad-${resume.id}`} className="sr-only">
            CV&apos;nin adı
          </Label>
          <Input id={`cv-ad-${resume.id}`} autoFocus placeholder={resume.fileName ?? "CV'nin adı"} {...form.register("label")} />
          {form.formState.errors.label && (
            <p role="alert" className="m-0 text-sm text-brand-amber">
              {form.formState.errors.label.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={saving}>
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddResumeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const upload = useUploadResume()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<z.input<typeof addSchema>, unknown, z.output<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: { label: "" },
  })
  const file = form.watch("cv") as File | undefined

  function change(next: boolean) {
    onOpenChange(next)
    if (!next) {
      form.reset({ label: "" })
      setError(null)
    }
  }

  const submit = form.handleSubmit(async ({ cv, label }) => {
    setError(null)
    try {
      await upload.mutateAsync({ file: cv as File, label: label ?? "" })
      change(false)
    } catch (e) {
      setError(await apiErrorMessage(e, "CV'ni kaydedemedik."))
    }
  })

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>CV ekle</DialogTitle>
          <DialogDescription>PDF ya da Word. Kaydettiğin CV her analizde seçilebilir.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-3">
          <ResumeUpload
            value={file ?? null}
            error={form.formState.errors.cv?.message}
            onChange={(next) => {
              form.setValue("cv", (next ?? undefined) as File | undefined, { shouldValidate: next !== null })
              if (!next) form.clearErrors("cv")
            }}
          />
          <Input aria-label="CV'nin adı (isteğe bağlı)" placeholder="CV'nin adı (isteğe bağlı)" {...form.register("label")} />
          {error && (
            <p role="alert" className="m-0 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => change(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
              Kaydet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Bu CV'yle analiz edilen ilanlar (DOG-137): şirket, unvan, panodaki aşama. */
function ResumeApplications({ resume }: { resume: LibraryResume }) {
  const apps = resume.applications ?? []
  const total = resume.applicationCount ?? apps.length
  if (total === 0) return <p className="m-0 text-sm text-muted-foreground">Bu CV&apos;yle henüz analiz yapmadın.</p>
  return (
    <div className="text-sm">
      <p className="m-0 text-xs font-medium text-muted-foreground">Bu CV&apos;yle analiz ettiğin ilanlar · {total}</p>
      <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
        {apps.map((a) => (
          <li key={a.analysisId} className="flex items-baseline gap-2">
            <Link
              href={`/applications/${encodeURIComponent(a.analysisId)}`}
              className="min-w-0 flex-1 truncate font-medium text-foreground no-underline hover:text-primary hover:underline"
            >
              {a.company ? `${a.company} · ${a.position}` : a.position}
            </Link>
            {isStage(a.stage) && <span className="shrink-0 text-xs text-muted-foreground">{STAGE_LABEL[a.stage]}</span>}
          </li>
        ))}
      </ul>
      {total > apps.length && (
        <Link href="/applications" className="mt-1.5 inline-block text-xs font-medium text-primary">
          Tümü Başvurular&apos;da
        </Link>
      )}
    </div>
  )
}
