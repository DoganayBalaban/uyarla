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
 * Asıl <input type="file" name="cv"> formun içinde kalıyor; sürüklenen dosya
 * DataTransfer ile ona yazılıyor. Böylece form gönderimi (FormData) ve
 * tarayıcının "zorunlu alan" doğrulaması olduğu gibi çalışıyor.
 */

const ACCEPT = [".pdf", ".docx"]

function sizePx(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ResumeUpload({ name = "cv" }: { name?: string }) {
  const inputValue = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setErrorMessage] = useState<string | null>(null)

  function select(fresh: File | null) {
    setErrorMessage(null)
    if (!fresh) return
    const extension = `.${fresh.name.toLowerCase().split(".").pop()}`
    if (!ACCEPT.includes(extension)) {
      setErrorMessage("Yalnızca PDF ve DOCX dosyalarını okuyabiliyoruz.")
      return
    }
    if (inputValue.current) {
      const dt = new DataTransfer()
      dt.items.add(fresh)
      inputValue.current.files = dt.files
    }
    setFile(fresh)
  }

  function remove() {
    if (inputValue.current) inputValue.current.value = ""
    setFile(null)
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
          "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-kart border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging
            ? "border-mavi bg-mavi/5"
            : "border-cizgi bg-zemin/60 hover:border-mavi/60 hover:bg-mavi/[0.03]",
          file && "sr-only",
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-kart text-mavi shadow-sm ring-1 ring-cizgi transition-transform group-hover:-translate-y-0.5 dark:text-[#8ea2ff]">
          <UploadCloud className="size-5" aria-hidden />
        </span>
        <span className="font-semibold">
          CV&apos;ni buraya bırak ya da <span className="text-mavi dark:text-[#8ea2ff]">seç</span>
        </span>
        <span className="text-sm text-gri">PDF veya Word (DOCX) · en fazla 10 MB</span>
        <input
          ref={inputValue}
          id="cv"
          name={name}
          type="file"
          accept={ACCEPT.join(",")}
          required
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
            className="flex items-center gap-3 rounded-kart border border-cizgi bg-kart p-3.5 shadow-sm"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-buton bg-mavi/10 text-mavi dark:text-[#8ea2ff]">
              <FileText className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate font-semibold">{file.name}</p>
              <p className="m-0 text-xs text-gri">{sizePx(file.size)} · hazır</p>
            </div>
            <button
              type="button"
              onClick={remove}
              className="grid size-8 place-items-center rounded-full text-gri transition-colors hover:bg-zemin hover:text-metin"
              aria-label="Dosyayı kaldır"
            >
              <X className="size-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mt-2 text-sm text-kehribar">{error}</p>}
    </div>
  )
}
