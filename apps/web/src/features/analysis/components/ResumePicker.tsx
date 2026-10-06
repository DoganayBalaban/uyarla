"use client"

import { FileText, Star, UploadCloud } from "lucide-react"
import type { LibraryResume } from "@/features/resumes/schema"
import { resumeTitle } from "@/features/resumes/library"
import { cn } from "@/lib/cn"

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" })

/**
 * Kayıtlı CV'ler (DOG-50): biri seçili ya da "Yeni dosya yükle". Seçim
 * analiz formunda; bu bileşen yalnızca çiziyor.
 */
export function ResumePicker({
  resumes,
  selectedId,
  onSelect,
  onUploadNew,
}: {
  resumes: LibraryResume[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUploadNew: () => void
}) {
  return (
    <div role="radiogroup" aria-label="Kayıtlı CV'lerin" className="grid gap-2">
      {resumes.map((resume) => (
        <label
          key={resume.id}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-card border p-3 transition-colors",
            selectedId === resume.id ? "border-brand-blue bg-brand-blue/5" : "border-border bg-card hover:border-brand-blue/50",
          )}
        >
          <input
            type="radio"
            name="libraryResume"
            className="sr-only"
            checked={selectedId === resume.id}
            onChange={() => onSelect(resume.id)}
          />
          <FileText className="size-5 shrink-0 text-brand-blue" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{resumeTitle(resume)}</span>
            <span className="text-xs text-muted">{DATE.format(new Date(resume.createdAt))}</span>
          </span>
          {resume.isDefault && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-amber/15 px-2 py-0.5 text-xs font-semibold">
              <Star className="size-3" aria-hidden /> Varsayılan
            </span>
          )}
        </label>
      ))}
      <label
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-card border border-dashed p-3 transition-colors",
          selectedId === null ? "border-brand-blue bg-brand-blue/5" : "border-border hover:border-brand-blue/50",
        )}
      >
        <input type="radio" name="libraryResume" className="sr-only" checked={selectedId === null} onChange={onUploadNew} />
        <UploadCloud className="size-5 shrink-0 text-muted" aria-hidden />
        <span className="font-semibold">Yeni dosya yükle</span>
      </label>
    </div>
  )
}
