"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { CircleAlert, Link2, LoaderCircle, PenLine } from "lucide-react"
import { apiErrorMessage } from "@/lib/api"
import { adaptationQueryKey, requestContribution } from "@/features/adaptation/api"
import { DecisionToggle, VerificationWarning } from "@/features/adaptation/components/DecisionControls"
import type { Contribution, DocumentOutline } from "@/features/adaptation/types"

const MIN_ANSWER = 20
const MAX_ANSWER = 600

/**
 * Eksik kalan zorunlular ve "AI ile yaz" (DOG-94).
 *
 * Uyarlama CV'de kanıtı olmayan gereksinime madde yazmıyor. Aday o işi
 * gerçekten yaptıysa burada anlatıyor; madde onun cevabından yazılıyor ve
 * cevaba karşı doğrulanıyor. Kalıp cümle yok: anlatılmayan şey eklenmez.
 */
export function ContributionsSection({
  adaptationId,
  missing,
  contributions,
  experience,
  busy,
  onDecide,
}: {
  adaptationId: string
  missing: Array<{ index: number; text: string }>
  contributions: Contribution[]
  experience: DocumentOutline["experience"]
  busy: boolean
  onDecide: (itemId: string, decision: "accepted" | "rejected") => void
}) {
  if (missing.length === 0 || experience.length === 0) return null
  return (
    <section className="rounded-card border border-border bg-card p-5 sm:p-6">
      <h2 className="m-0 text-lg">Eksik kalan zorunlular</h2>
      <p className="mt-1 text-sm text-muted">
        Bu gereksinimler için CV&apos;nde kanıt bulamadık, o yüzden yazmadık. Gerçekten yaptığın bir şeyse anlat; senin
        anlattığından bir madde yazalım. Anlatmadığın hiçbir şeyi eklemeyiz. Kabul ettiğin madde sonraki
        analizlerinde de kanıt sayılır; Hesabım&apos;dan unutabilirsin.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {missing.map((r) => (
          <RequirementContribution
            key={r.index}
            adaptationId={adaptationId}
            requirement={r}
            items={contributions.filter((c) => c.requirementIndex === r.index)}
            experience={experience}
            busy={busy}
            onDecide={onDecide}
          />
        ))}
      </ul>
    </section>
  )
}

function RequirementContribution({
  adaptationId,
  requirement,
  items,
  experience,
  busy,
  onDecide,
}: {
  adaptationId: string
  requirement: { index: number; text: string }
  items: Contribution[]
  experience: DocumentOutline["experience"]
  busy: boolean
  onDecide: (itemId: string, decision: "accepted" | "rejected") => void
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [job, setJob] = useState(0)
  const [answer, setAnswer] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const running = items.some((c) => c.status === "running")
  const length = answer.trim().length

  async function submit() {
    setError(null)
    setSending(true)
    try {
      await requestContribution(adaptationId, { requirementIndex: requirement.index, experienceIndex: job, answer })
      setOpen(false)
      setAnswer("")
      // Taslakta "running" katkı göründüğünde yoklama kendiliğinden başlıyor.
      await queryClient.invalidateQueries({ queryKey: adaptationQueryKey(adaptationId) })
    } catch (e) {
      setError(await apiErrorMessage(e, "Gönderemedik. Birazdan tekrar dener misin?"))
    } finally {
      setSending(false)
    }
  }

  return (
    <li className="py-4">
      <p className="m-0 font-medium">{requirement.text}</p>

      {items.map((c) => (
        <ContributionItem key={c.id} item={c} experience={experience} busy={busy} onDecide={onDecide} />
      ))}

      {!open && !running && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue underline-offset-2 hover:underline"
        >
          <PenLine className="size-4" aria-hidden />
          {items.length > 0 ? "Başka bir deneyim anlat" : "Bu konuda deneyimim var, anlatayım"}
        </button>
      )}

      {open && (
        <div className="mt-3 space-y-3 rounded-button border border-border bg-background/60 p-4">
          <label className="block text-sm">
            <span className="font-medium">Hangi işte?</span>
            <select
              value={job}
              onChange={(e) => setJob(Number(e.target.value))}
              className="mt-1 block w-full rounded-button border border-border bg-card px-3 py-2"
            >
              {experience.map((e, i) => (
                <option key={i} value={i}>
                  {[e.title, e.company].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Ne yaptın?</span>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              maxLength={MAX_ANSWER}
              placeholder="Kendi sözlerinle: ne yaptın, hangi araçla, sonuç ne oldu? Rakam varsa yaz."
              className="mt-1 block w-full rounded-button border border-border bg-card px-3 py-2"
            />
            <span className="mt-1 block text-xs text-muted">
              {length < MIN_ANSWER ? `En az ${MIN_ANSWER} karakter (${length})` : `${length}/${MAX_ANSWER}`}
            </span>
          </label>
          {error && (
            <p role="alert" className="m-0 flex items-start gap-1.5 text-sm text-brand-red dark:text-[#f87171]">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sending || length < MIN_ANSWER}
              onClick={() => void submit()}
              className="rounded-button bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Maddeye çevir
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-button border border-border px-4 py-2 text-sm font-semibold"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function ContributionItem({
  item,
  experience,
  busy,
  onDecide,
}: {
  item: Contribution
  experience: DocumentOutline["experience"]
  busy: boolean
  onDecide: (itemId: string, decision: "accepted" | "rejected") => void
}) {
  if (item.status === "running") {
    return (
      <p className="mt-2 flex items-center gap-2 text-sm text-muted">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Anlattığını maddeye çeviriyoruz…
      </p>
    )
  }
  if (item.status === "failed") {
    return <p className="mt-2 text-sm text-brand-red dark:text-[#f87171]">Maddeyi yazamadık. Tekrar dener misin?</p>
  }
  if (!item.text) {
    return (
      <p className="mt-2 text-sm text-muted">
        Anlattığından bir CV maddesi çıkaramadık. Ne yaptığını biraz daha somut anlatır mısın?
      </p>
    )
  }

  const job = experience[item.experienceIndex]
  return (
    <div className="mt-3 rounded-button border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted">
          {job ? `${job.title}${job.company ? ` · ${job.company}` : ""} işine eklenecek` : "Yeni madde"}
          {item.decision === "pending" && <span className="ml-2 text-brand-blue">· Karar bekliyor</span>}
        </span>
        <DecisionToggle
          val={item.decision}
          busy={busy}
          onSelect={(d) => onDecide(item.id, d)}
          labels={{ accepted: "CV'ye ekle", rejected: "Ekleme" }}
        />
      </div>
      {item.verification && <VerificationWarning v={item.verification} />}
      <p className="m-0 leading-relaxed">{item.text}</p>
      {(item.alignments?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1">
          {item.alignments!.map((a) => (
            <li key={a.term} className="flex gap-2 text-sm text-muted">
              <Link2 className="mt-0.5 size-3.5 shrink-0 text-brand-blue" aria-hidden />
              <span>
                <span className="font-semibold text-foreground">{a.term}</span>, senin{" "}
                <span className="text-foreground">&ldquo;{a.basis}&rdquo;</span> ifadene dayanıyor.
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 mb-0 text-xs text-muted">Senin anlattığın: &ldquo;{item.answer}&rdquo;</p>
    </div>
  )
}
