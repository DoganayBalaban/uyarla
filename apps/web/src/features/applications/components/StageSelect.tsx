"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STAGES, STAGE_COLOR, STAGE_LABEL, type Stage } from "@/features/applications/board"
import { cn } from "@/lib/cn"

/** Başvurunun aşaması (DOG-148): pano kartı, tablo satırı ve detay başlığı aynı seçimi kullanıyor. */
export function StageSelect({
  value,
  onChange,
  size = "sm",
  className,
  label = "Aşama",
}: {
  value: Stage
  onChange: (stage: Stage) => void
  size?: "sm" | "default"
  className?: string
  label?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Stage)}>
      <SelectTrigger size={size} aria-label={label} className={cn("gap-1.5", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGES.map((s) => (
          <SelectItem key={s} value={s}>
            <span aria-hidden className={cn("size-2 rounded-full", STAGE_COLOR[s])} />
            {STAGE_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
