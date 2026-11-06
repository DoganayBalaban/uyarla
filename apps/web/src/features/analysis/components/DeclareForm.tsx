"use client"

import { useId, useState } from "react"
import { LoaderCircle } from "lucide-react"
import type { DeclarationInput, DeclareTarget } from "@uyarla/core/adapt/declarations"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ScorePart } from "@/features/analysis/scoreParts"

const MIN_TEXT = 10
const MAX_TEXT = 200
const MIN_NAME = 2
const MAX_NAME = 120

/**
 * "Bende var" formu (K-114), satırın altında açılıyor. Tek terimli beceri buraya
 * gelmiyor, tek tıkla gönderiliyor. Sınırlar sunucudakiyle aynı
 * (parseAnalysisPatch); burada yalnızca düğmeyi açıp kapatıyorlar.
 */
export function DeclareForm({
  part,
  targets,
  onSubmit,
  onCancel,
}: {
  part: ScorePart
  targets: DeclareTarget[]
  onSubmit: (declaration: DeclarationInput) => Promise<void>
  onCancel: () => void
}) {
  const id = useId()
  const [saving, setSaving] = useState(false)
  const [terms, setTerms] = useState<string[]>([])
  const [target, setTarget] = useState<string>(targets.length === 1 ? "0" : "")
  const [text, setText] = useState("")
  const [school, setSchool] = useState("")
  const [field, setField] = useState("")

  const input = ((): DeclarationInput | null => {
    if (part.type === "skill") return terms.length > 0 ? { kind: "skill", terms } : null
    if (part.type === "education") {
      const [s, f] = [school.trim(), field.trim()]
      return s.length >= MIN_NAME && f.length >= MIN_NAME ? { kind: "education", school: s, field: f } : null
    }
    const chosen = targets[Number(target)]
    const sentence = text.trim()
    if (target === "" || !chosen || sentence.length < MIN_TEXT || sentence.length > MAX_TEXT) return null
    return { kind: "experience", target: { section: chosen.section, index: chosen.index }, text: sentence }
  })()

  const submit = async () => {
    if (!input) return
    setSaving(true)
    try {
      await onSubmit(input)
    } catch {
      // Hata üstte gösteriliyor; form açık kalsın, kullanıcı tekrar denesin.
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-3 pb-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      {part.type === "skill" && (
        <fieldset className="m-0 space-y-2 border-0 p-0">
          <legend className="mb-2 p-0 text-xs text-muted-foreground">Hangileri sende var?</legend>
          {part.missing.map((term) => (
            <Label key={term} className="flex items-center gap-2 font-normal">
              <Checkbox
                checked={terms.includes(term)}
                onCheckedChange={(checked) => setTerms((list) => (checked === true ? [...list, term] : list.filter((t) => t !== term)))}
              />
              {term}
            </Label>
          ))}
        </fieldset>
      )}

      {part.type === "experience" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-target`} className="text-xs font-normal text-muted-foreground">
              Hangi işte?
            </Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger id={`${id}-target`} className="w-full">
                <SelectValue placeholder="Seç" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t, i) => (
                  <SelectItem key={`${t.section}-${t.index}`} value={String(i)}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-text`} className="text-xs font-normal text-muted-foreground">
              Ne yaptın? Bu cümle CV&apos;ne girecek.
            </Label>
            <Textarea id={`${id}-text`} rows={2} maxLength={MAX_TEXT} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </>
      )}

      {part.type === "education" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-school`} className="text-xs font-normal text-muted-foreground">
              Okul
            </Label>
            <Input id={`${id}-school`} maxLength={MAX_NAME} value={school} onChange={(e) => setSchool(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-field`} className="text-xs font-normal text-muted-foreground">
              Bölüm
            </Label>
            <Input id={`${id}-field`} maxLength={MAX_NAME} value={field} onChange={(e) => setField(e.target.value)} />
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving || !input}>
          {saving && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
          Ekle
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Vazgeç
        </Button>
      </div>
    </form>
  )
}
