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

const KABUL = [".pdf", ".docx"]

function boyut(bayt: number): string {
  if (bayt < 1024 * 1024) return `${Math.max(1, Math.round(bayt / 1024))} KB`
  return `${(bayt / 1024 / 1024).toFixed(1)} MB`
}

export function CvYukleme({ name = "cv" }: { name?: string }) {
  const girdi = useRef<HTMLInputElement>(null)
  const [dosya, setDosya] = useState<File | null>(null)
  const [surukleniyor, setSurukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  function sec(yeni: File | null) {
    setHata(null)
    if (!yeni) return
    const uzanti = `.${yeni.name.toLowerCase().split(".").pop()}`
    if (!KABUL.includes(uzanti)) {
      setHata("Yalnızca PDF ve DOCX dosyalarını okuyabiliyoruz.")
      return
    }
    if (girdi.current) {
      const dt = new DataTransfer()
      dt.items.add(yeni)
      girdi.current.files = dt.files
    }
    setDosya(yeni)
  }

  function kaldir() {
    if (girdi.current) girdi.current.value = ""
    setDosya(null)
  }

  return (
    <div>
      <label
        htmlFor="cv"
        onDragOver={(e) => {
          e.preventDefault()
          setSurukleniyor(true)
        }}
        onDragLeave={() => setSurukleniyor(false)}
        onDrop={(e) => {
          e.preventDefault()
          setSurukleniyor(false)
          sec(e.dataTransfer.files[0] ?? null)
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-kart border-2 border-dashed px-6 py-8 text-center transition-colors",
          surukleniyor
            ? "border-mavi bg-mavi/5"
            : "border-cizgi bg-zemin/60 hover:border-mavi/60 hover:bg-mavi/[0.03]",
          dosya && "sr-only",
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
          ref={girdi}
          id="cv"
          name={name}
          type="file"
          accept={KABUL.join(",")}
          required
          onChange={(e) => sec(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
      </label>

      <AnimatePresence>
        {dosya && (
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
              <p className="m-0 truncate font-semibold">{dosya.name}</p>
              <p className="m-0 text-xs text-gri">{boyut(dosya.size)} · hazır</p>
            </div>
            <button
              type="button"
              onClick={kaldir}
              className="grid size-8 place-items-center rounded-full text-gri transition-colors hover:bg-zemin hover:text-metin"
              aria-label="Dosyayı kaldır"
            >
              <X className="size-4" aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {hata && <p className="mt-2 text-sm text-kehribar">{hata}</p>}
    </div>
  )
}
