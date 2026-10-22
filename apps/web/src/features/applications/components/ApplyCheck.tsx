"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import type { BoardCard } from "@/features/applications/board"

/**
 * Başvuru kapısı (DOG-91): skor düşükken "önce uyarlamak ister misin?".
 * Durdurmuyor; uyarlama "Uyarla"daki akışla (giriş ve paket dönüşü dahil).
 * shadcn AlertDialog (DOG-148).
 */
export function ApplyCheck({ card, onApply, onClose }: { card: BoardCard; onApply: () => void; onClose: () => void }) {
  const r = card.readiness!
  const gaps = [
    r.missingMust > 0 ? `${r.missingMust} zorunlu gereksinim CV'nde görünmüyor` : null,
    r.titleMissing ? "ilandaki unvan CV'nde geçmiyor" : null,
  ].filter(Boolean)
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Önce uyarlamak ister misin?</AlertDialogTitle>
          <AlertDialogDescription>
            {card.position}: {gaps.join("; ")}. Deneyiminde varsa uyarlamada görünür kılabiliriz; olmayan bir şeyi
            eklemiyoruz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <Button type="button" variant="outline" onClick={onApply}>
            Yine de başvurdum
          </Button>
          <Button asChild autoFocus>
            <Link href={`/analyze?uyarla=${encodeURIComponent(card.analysisId)}`}>
              Önce uyarla
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
