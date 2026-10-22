"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, ClipboardList, Copy, LoaderCircle, TriangleAlert } from "lucide-react"
import {
  LIMIT_RANGE,
  MAX_FORM_ANSWERS,
  QUESTION_MAX_LENGTH,
  measure,
  type FormAnswerLimit,
  type FormAnswerRecord,
} from "@uyarla/core/cover/formAnswerRecord"
import { api, apiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/cn"
import { adaptationQueryKey } from "@/features/adaptation/api"

const UNIT_LABEL = { chars: "karakter", words: "kelime" } as const

/**
 * Başvuru formu yanıtları (DOG-123): "kendini tanıt", "140 karakterde neden
 * sen" gibi sorular. Yanıt gönderilen CV'den ve ön yazıdan; sınır kodda
 * denetleniyor. Biz göndermiyoruz; kullanıcı kopyalıyor.
 */
export function FormAnswersSection({
  adaptationId,
  analysisId,
  answers,
}: {
  adaptationId: string
  analysisId: string
  answers: FormAnswerRecord[]
}) {
  const queryClient = useQueryClient()
  const [question, setQuestion] = useState("")
  const [unit, setUnit] = useState<FormAnswerLimit["unit"] | "none">("none")
  const [max, setMax] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const running = answers.some((a) => a.status === "running")
  const left = MAX_FORM_ANSWERS - answers.filter((a) => a.status !== "failed").length

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      const limit = unit === "none" ? null : { unit, max: Number(max) }
      await api.post(`/applications/${encodeURIComponent(analysisId)}`, { type: "form-answer", question, limit })
      setQuestion("")
      await queryClient.invalidateQueries({ queryKey: adaptationQueryKey(adaptationId) })
    } catch (e) {
      setError(await apiErrorMessage(e, "Yanıtı başlatamadık. Birazdan tekrar dener misin?"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
      <h2 className="m-0 flex items-center gap-2 text-lg">
        <ClipboardList className="size-5 text-brand-blue" aria-hidden />
        Form sorusu yanıtla
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Başvuru formundaki soruyu ve varsa sınırını yapıştır. Yanıtı gönderdiğin CV&apos;den ve ön yazından yazıyoruz;
        köşeli parantezli yeri kendi gerekçenle doldur.
      </p>

      {answers.length > 0 && (
        <ol className="mt-4 space-y-4 pl-0">
          {[...answers].reverse().map((a) => (
            <AnswerItem key={a.id} answer={a} />
          ))}
        </ol>
      )}

      {left > 0 ? (
        <div className="mt-4 space-y-2">
          <label htmlFor="form-question" className="block text-sm font-medium">
            Soru
          </label>
          <textarea
            id="form-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={QUESTION_MAX_LENGTH}
            rows={2}
            placeholder="Örn. Neden bu pozisyona başvuruyorsunuz?"
            className="w-full rounded-button border border-border bg-background p-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="form-limit-unit">Sınır</label>
            <select
              id="form-limit-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as typeof unit)}
              className="rounded-button border border-border bg-background px-2 py-1"
            >
              <option value="none">Yok</option>
              <option value="chars">Karakter</option>
              <option value="words">Kelime</option>
            </select>
            {unit !== "none" && (
              <input
                type="number"
                inputMode="numeric"
                aria-label={`En fazla ${UNIT_LABEL[unit]}`}
                min={LIMIT_RANGE[unit].min}
                max={LIMIT_RANGE[unit].max}
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder={unit === "chars" ? "140" : "100"}
                className="w-24 rounded-button border border-border bg-background px-2 py-1"
              />
            )}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || running || question.trim().length < 5 || (unit !== "none" && !max)}
              className="ml-auto rounded-button bg-brand-blue px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              Yanıtla
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Bu başvuru için form yanıtı hakkın doldu.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-brand-red dark:text-[#f87171]">
          {error}
        </p>
      )}
    </section>
  )
}

function AnswerItem({ answer }: { answer: FormAnswerRecord }) {
  const [copied, setCopied] = useState(false)
  const size = answer.text && answer.limit ? measure(answer.text, answer.limit.unit) : null
  const over = size !== null && answer.limit !== null && size > answer.limit.max
  return (
    <li className="list-none rounded-button border border-border p-3 text-sm">
      <p className="m-0 font-semibold">{answer.question}</p>
      {answer.status === "running" && (
        <p className="m-0 mt-2 flex items-center gap-2 text-muted-foreground" role="status">
          <LoaderCircle className="size-4 text-brand-blue motion-safe:animate-spin" aria-hidden />
          Yanıtı yazıyoruz…
        </p>
      )}
      {answer.status === "failed" && <p className="m-0 mt-2 text-brand-red">Yanıtı yazamadık. Tekrar dener misin?</p>}
      {answer.status === "done" && answer.text && (
        <>
          <p className="m-0 mt-2 whitespace-pre-line">{answer.text}</p>
          {answer.verification?.status === "flagged" && (
            <p className="m-0 mt-2 flex gap-1.5 text-brand-amber">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>Kontrol et: {answer.verification.issues.map((i) => i.detail).join(" ")}</span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {size !== null && answer.limit && (
              <span className={cn(over && "font-semibold text-brand-red")}>
                {size}/{answer.limit.max} {UNIT_LABEL[answer.limit.unit]}
                {over && " · sınırı aşıyor, kısaltman gerek"}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(answer.text!).then(() => setCopied(true))
              }}
              className="inline-flex items-center gap-1 font-semibold text-brand-blue"
            >
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
        </>
      )}
    </li>
  )
}
