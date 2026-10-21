"use client"

import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { FileText, LoaderCircle, Pencil, Star, Trash2 } from "lucide-react"
import { ResumeUpload } from "@/features/analysis/components/ResumeUpload"
import { resumeFileSchema } from "@/features/analysis/schema"
import { useLibrary, useRemoveResume, useUpdateResume, useUploadResume } from "@/features/resumes/api"
import { isLibraryFull, resumeTitle } from "@/features/resumes/library"
import { LIBRARY_MAX, labelSchema, type LibraryResume } from "@/features/resumes/schema"
import { STAGE_LABEL, isStage } from "@/features/applications/board"
import { apiErrorMessage } from "@/lib/api"

const addSchema = z.object({ cv: resumeFileSchema, label: labelSchema })
const renameSchema = z.object({ label: labelSchema })

const inputClass =
  "w-full rounded-button border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-blue"
const smallButton = "inline-flex items-center gap-1 rounded-button border border-border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"

/**
 * CV kütüphanesi (DOG-50, spec §5): listele, yeniden adlandır, temel CV yap,
 * kaldır, ekle. Her CV'nin altında o CV'yle yapılmış başvurular (DOG-137).
 */
export function ResumeLibrarySection() {
  const library = useLibrary(true)
  const resumes = library.data ?? []
  const full = isLibraryFull(resumes)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg">CV&apos;lerim</h2>
        <span className="text-sm text-muted-foreground">{resumes.length}/{LIBRARY_MAX}</span>
      </div>
      <p className="m-0 mt-1 text-sm text-muted-foreground">
        Analizde yeniden yüklemek yerine buradan seçersin; temel CV yeni analizde seçili gelir. Kaldırdığın CV&apos;yle
        yapılmış analizler panoda kalır.
      </p>

      {library.isPending ? (
        <LoaderCircle className="mt-4 size-5 motion-safe:animate-spin text-muted-foreground" aria-hidden />
      ) : resumes.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Henüz kayıtlı CV&apos;n yok.</p>
      ) : (
        <ul className="mt-4 grid list-none gap-2 p-0">
          {resumes.map((resume) => (
            <ResumeRow key={resume.id} resume={resume} onError={setError} />
          ))}
        </ul>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-brand-red">{error}</p>}

      {adding ? (
        <AddResumeForm onDone={() => setAdding(false)} onError={setError} />
      ) : (
        <div className="mt-4">
          <button type="button" disabled={full} onClick={() => setAdding(true)} className="rounded-button bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            CV ekle
          </button>
          {full && <p className="mt-2 text-sm text-muted-foreground">En fazla {LIBRARY_MAX} CV kaydedebilirsin. Yeni eklemek için birini kaldır.</p>}
        </div>
      )}
    </section>
  )
}

function ResumeRow({ resume, onError }: { resume: LibraryResume; onError: (message: string | null) => void }) {
  const update = useUpdateResume()
  const remove = useRemoveResume()
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const form = useForm<z.input<typeof renameSchema>, unknown, z.output<typeof renameSchema>>({
    resolver: zodResolver(renameSchema),
    defaultValues: { label: resume.label ?? "" },
  })

  async function guard(action: () => Promise<unknown>, fallback: string) {
    onError(null)
    try {
      await action()
      return true
    } catch (error) {
      onError(await apiErrorMessage(error, fallback))
      return false
    }
  }

  const rename = form.handleSubmit(async ({ label }) => {
    if (await guard(() => update.mutateAsync({ id: resume.id, patch: { label } }), "Adını değiştiremedik.")) setRenaming(false)
  })

  return (
    <li className="rounded-button border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="size-4 shrink-0 text-brand-blue" aria-hidden />
        {renaming ? (
          <form onSubmit={rename} noValidate className="flex min-w-0 flex-1 gap-2">
            <input aria-label="CV'nin adı" autoFocus {...form.register("label")} className={inputClass} />
            <button type="submit" className={smallButton} disabled={update.isPending}>Kaydet</button>
          </form>
        ) : (
          <span className="min-w-0 flex-1 truncate font-medium">{resumeTitle(resume)}</span>
        )}
        {resume.isDefault ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-amber/15 px-2 py-0.5 text-xs font-semibold">
            <Star className="size-3" aria-hidden /> Temel CV
          </span>
        ) : (
          <button type="button" className={smallButton} disabled={update.isPending}
            onClick={() => void guard(() => update.mutateAsync({ id: resume.id, patch: { isDefault: true } }), "Temel CV yapamadık.")}>
            Temel CV yap
          </button>
        )}
        {!renaming && (
          <button type="button" className={smallButton} onClick={() => setRenaming(true)} aria-label={`${resumeTitle(resume)} adını değiştir`}>
            <Pencil className="size-3" aria-hidden />
          </button>
        )}
        <button type="button" className={smallButton} onClick={() => setConfirming(true)} aria-label={`${resumeTitle(resume)} kaldır`}>
          <Trash2 className="size-3" aria-hidden />
        </button>
      </div>
      {form.formState.errors.label && <p role="alert" className="mt-1 text-sm text-brand-amber">{form.formState.errors.label.message}</p>}
      <ResumeApplications resume={resume} />
      {confirming && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-button bg-brand-red/5 p-2.5 text-sm">
          <span className="flex-1">Kütüphaneden kaldırılsın mı? Bu CV&apos;yle yapılmış analizler panoda kalır.</span>
          <button type="button" className="rounded-button bg-brand-red px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" disabled={remove.isPending}
            onClick={() => void guard(() => remove.mutateAsync(resume.id), "Kaldıramadık.").then((ok) => ok && setConfirming(false))}>
            Kaldır
          </button>
          <button type="button" className={smallButton} onClick={() => setConfirming(false)}>Vazgeç</button>
        </div>
      )}
    </li>
  )
}

function AddResumeForm({ onDone, onError }: { onDone: () => void; onError: (message: string | null) => void }) {
  const upload = useUploadResume()
  const form = useForm<z.input<typeof addSchema>, unknown, z.output<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: { label: "" },
  })
  const file = form.watch("cv") as File | undefined

  const submit = form.handleSubmit(async ({ cv, label }) => {
    onError(null)
    try {
      await upload.mutateAsync({ file: cv as File, label: label ?? "" })
      onDone()
    } catch (error) {
      onError(await apiErrorMessage(error, "CV'ni kaydedemedik."))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="mt-4 grid gap-3">
      <ResumeUpload
        value={file ?? null}
        error={form.formState.errors.cv?.message}
        onChange={(next) => {
          form.setValue("cv", (next ?? undefined) as File | undefined, { shouldValidate: next !== null })
          if (!next) form.clearErrors("cv")
        }}
      />
      <input aria-label="CV'nin adı (isteğe bağlı)" placeholder="CV'nin adı (isteğe bağlı)" {...form.register("label")} className={inputClass} />
      <div className="flex gap-2">
        <button type="submit" disabled={upload.isPending} className="inline-flex items-center gap-2 rounded-button bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {upload.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
          Kaydet
        </button>
        <button type="button" onClick={onDone} className={smallButton}>Vazgeç</button>
      </div>
    </form>
  )
}

/** Bu CV'yle analiz edilen ilanlar (DOG-137): şirket, unvan, panodaki aşama. */
function ResumeApplications({ resume }: { resume: LibraryResume }) {
  const apps = resume.applications ?? []
  const total = resume.applicationCount ?? apps.length
  if (total === 0) return <p className="m-0 mt-2 pl-6 text-xs text-muted-foreground">Bu CV&apos;yle henüz analiz yapmadın.</p>
  return (
    <div className="mt-2 pl-6 text-xs">
      <p className="m-0 text-muted-foreground">Bu CV&apos;yle analiz ettiğin ilanlar ({total}):</p>
      <ul className="m-0 mt-1 list-none space-y-0.5 p-0">
        {apps.map((a) => (
          <li key={a.analysisId} className="truncate">
            <Link href={`/analyze?analiz=${encodeURIComponent(a.analysisId)}`} className="font-medium text-foreground underline-offset-2 hover:underline">
              {a.company ? `${a.company} · ${a.position}` : a.position}
            </Link>
            {isStage(a.stage) && <span className="text-muted-foreground"> · {STAGE_LABEL[a.stage]}</span>}
          </li>
        ))}
      </ul>
      {total > apps.length && (
        <Link href="/applications" className="mt-1 inline-block font-semibold text-brand-blue">
          Tümü başvuru panosunda
        </Link>
      )}
    </div>
  )
}
