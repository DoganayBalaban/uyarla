"use client"

import { useState } from "react"
import { LoaderCircle, Trash2 } from "lucide-react"
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
import { useDeleteApplication } from "@/features/applications/api"
import { apiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/cn"

/**
 * "Başvuruyu sil" (DOG-171): pano kartında ve başvuru ayrıntısında. Geri
 * alınamaz, onay penceresi silinecekleri sayıyor. Kütüphanedeki CV'lere
 * dokunulmuyor; harcanan ücretsiz hak geri gelmiyor.
 */
export function DeleteApplication({
  analysisId,
  position,
  onDeleted,
  className,
}: {
  analysisId: string
  position: string
  onDeleted?: () => void
  className?: string
}) {
  const remove = useDeleteApplication()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setError(null)
    try {
      await remove.mutateAsync(analysisId)
      setOpen(false)
      onDeleted?.()
    } catch (e) {
      setError(await apiErrorMessage(e, "Başvuruyu silemedik. Birazdan tekrar dener misin?"))
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Başvuruyu sil: ${position}`}
          title="Başvuruyu sil"
          className={cn("size-7 text-muted-foreground hover:text-destructive", className)}
        >
          <Trash2 aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Başvuruyu silmek istediğine emin misin?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{position}&rdquo; ilanı, analizi, uyarlanmış CV&apos;si, ön yazısı, form yanıtları, mülakat paketi ve notlarıyla birlikte silinir. Geri
            alınamaz. CV&apos;lerim&apos;deki CV&apos;lerine dokunulmaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="m-0 text-sm text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Vazgeç</AlertDialogCancel>
          {/* Kendi düğmemiz: AlertDialogAction tıklayınca kapanıyor, hata gösterilemiyordu (hesap silmedeki gibi). */}
          <Button type="button" className="bg-destructive text-white hover:bg-destructive/90" disabled={remove.isPending} onClick={() => void confirm()}>
            {remove.isPending && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
            {remove.isPending ? "Siliniyor…" : "Evet, sil"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
