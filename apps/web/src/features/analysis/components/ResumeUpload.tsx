"use client"

import { useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { FileText, UploadCloud, X } from "lucide-react"
import { cn } from "@/lib/cn"

/**
 * CV yükleme alanı: sürükle-bırak ya da tıklayıp seç.
 *
 * 21st.dev'deki "File Upload" bloklarının (blocks.so, Ephraim Duncan —
 * https://21st.dev/@ephraimduncan/components/file-upload-1) çok dosyalı
 * dropzone deseninden uyarlandı: kesik kenarlı bırakma alanı ve seçilen
 * dosyanın kartı. Tek dosya ve yalnızca PDF/DOCX.
 *
 * Kontrollü bileşen: dosyayı react-hook-form tutuyor (`value`/`onChange`),
 * doğrulama analiz şemasında (`features/analysis/schema.ts`). Seçilen ya da
 * bırakılan her dosya forma iletiliyor; desteklenmeyen biçimi şema söylüyor.
 */

const ACCEPT = [".pdf", ".docx"]

function sizePx(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ResumeUpload({
  value,
  onChange,
  error,
}: {
  value: File | null
  onChange: (file: File | null) => void
  error?: string
}) {
  const inputValue = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  // Geçersiz dosya da forma gidiyor ki şema hatasını göstersin; kart yalnızca
  // hatasız dosyada çıkıyor.
  const file = value && !error ? value : null

  function select(fresh: File | null) {
    if (!fresh) return
    onChange(fresh)
  }

  function remove() {
    if (inputValue.current) inputValue.current.value = ""
    onChange(null)
  }

  return (
    <div>
      <label
        htmlFor="cv"
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          select(e.dataTransfer.files[0] ?? null)
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging
            ? "border-brand-blue bg-brand-blue/5"
            : "border-border bg-background/60 hover:border-brand-blue/60 hover:bg-brand-blue/[0.03]",
          file && "sr-only",
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-card text-brand-blue shadow-sm ring-1 ring-border transition-transform group-hover:-translate-y-0.5 dark:text-[#8ea2ff]">
          <UploadCloud className="size-5" aria-hidden />
        </span>
        <span className="font-semibold">
          CV&apos;ni buraya bırak ya da <span className="text-brand-blue dark:text-[#8ea2ff]">seç</span>
        </span>
        <span className="text-sm text-muted">PDF veya Word (DOCX) · en fazla 10 MB</span>
        <input
          ref={inputValue}
          id="cv"
          type="file"
          accept={ACCEPT.join(",")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "cv-error" : undefined}
          onChange={(e) => select(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>

      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-3 rounded-card border border-border bg-card p-3.5 shadow-sm"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-button bg-brand-blue/10 text-brand-blue dark:text-[#8ea2ff]">
              <FileText className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate font-semibold">{file.name}</p>
              <p className="m-0 text-xs text-muted">{sizePx(file.size)} · hazır</p>
            </div>
            <button
              type="button"
              onClick={remove}
              className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-background hover:text-foreground"
              aria-label="Dosyayı kaldır"
            >
              <X className="size-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p id="cv-error" role="alert" className="mt-2 text-sm text-brand-amber">
          {error}
        </p>
      )}
    </div>
  )
}
