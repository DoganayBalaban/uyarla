"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Check, LoaderCircle, TriangleAlert, X } from "lucide-react"
import type { InterviewPrep, InterviewPrepRecord } from "@uyarla/core/interview/prep"
import {
  ANSWER_MAX_LENGTH,
  ANSWER_MAX_WORDS,
  ANSWER_MIN_LENGTH,
  ANSWER_MIN_WORDS,
  MAX_PRACTICE_PER_QUESTION,
  type PracticeEntry,
} from "@uyarla/core/interview/practiceRecord"
import { api, apiErrorMessage, apiStatus } from "@/lib/api"
import { StageTimeline } from "@/features/analysis/components/StageTimeline"
import { deriveStageStates } from "@/features/analysis/stageStates"

/** Paketin gerçek adımları (DOG-136); hangisinde olduğunu worker kayda yazıyor. */
const PREP_STAGES = [
  { id: "reading", title: "Gönderdiğin belgeleri okuyoruz", description: "Başvurduğun CV, ön yazı ve ilanın eksik kalan şartları." },
  { id: "writing", title: "Olası soruları ve cevap iskeletlerini yazıyoruz", description: "Kanıtlar CV'nden birebir alınıyor ve kontrol ediliyor." },
]

interface PrepData {
  position: string
  company: string | null
  stage: string
  interviewAt: string | null
  adaptationId: string | null
  interviewPrep: InterviewPrepRecord | null
  prepAttemptsLeft: number
}

const key = (id: string) => ["interview-prep", id] as const

const KIND_LABEL = { technical: "Teknik", behavioral: "Davranışsal", gap: "Boşluk" } as const
const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", timeZone: "UTC" })

/**
 * Mülakat hazırlık paketi (DOG-118). Kaynak başvurunun gönderilen CV'si ve
 * ön yazısı: kanıtlar CV'den birebir, köşeli parantezli yerleri kullanıcı
 * kendi bildiğiyle dolduruyor. "Kağıtta olmayan iddia odada yok."
 */
export function InterviewPrepView({ analysisId }: { analysisId: string }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const query = useQuery({
    queryKey: key(analysisId),
    queryFn: async () => (await api.get<PrepData>(`/applications/${encodeURIComponent(analysisId)}`)).data,
    refetchInterval: (q) => {
      const r = q.state.data?.interviewPrep
      return r?.status === "running" || r?.practice?.some((p) => p.status === "running") ? 2500 : false
    },
  })
  const start = useMutation({
    mutationFn: async () => {
      await api.post(`/applications/${encodeURIComponent(analysisId)}`, { type: "interview-prep" })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(analysisId) }),
  })

  if (query.isPending) return <LoaderCircle className="size-5 text-muted motion-safe:animate-spin" aria-hidden />
  if (query.isError) {
    return (
      <p className="text-muted">
        {apiStatus(query.error) === 404 ? "Bu başvuruyu bulamadık." : "Yükleyemedik. Sayfayı yenileyebilir misin?"}
      </p>
    )
  }
  const data = query.data
  const record = data.interviewPrep
  const prep = record?.prep
  const running = record?.status === "running"

  async function create() {
    setError(null)
    try {
      await start.mutateAsync()
    } catch (e) {
      setError(await apiErrorMessage(e, "Hazırlık paketini başlatamadık. Birazdan tekrar dener misin?"))
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/applications" className="inline-flex items-center gap-1 text-sm text-muted no-underline hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Başvuru panosu
      </Link>
      <div>
        <h1 className="m-0 font-heading text-3xl font-extrabold tracking-tight">Mülakat hazırlığı</h1>
        <p className="mt-2 text-muted">
          {data.position}
          {data.company ? ` · ${data.company}` : ""}
          {data.interviewAt ? ` · ${DATE.format(new Date(`${data.interviewAt}T00:00:00Z`))}` : ""}
        </p>
        <p className="mt-2 text-sm text-muted">
          Gönderdiğin CV&apos;den ve ön yazından hazırlandı. Kağıtta olmayan bir iddiayı mülakatta da kurma; köşeli
          parantezli yerleri kendi bildiğinle doldur.
          {data.adaptationId && (
            <>
              {" "}
              <Link href={`/adapt/${data.adaptationId}`} className="font-medium text-brand-blue">
                Gönderdiğin CV
              </Link>
            </>
          )}
        </p>
      </div>

      {running && record?.status === "running" && (
        <StageTimeline
          heading="Hazırlık paketin hazırlanıyor"
          subtitle="Bir dakika kadar sürebilir."
          stages={deriveStageStates(PREP_STAGES, record.stage ?? null)}
        />
      )}
      {record?.status === "failed" && <p className="text-sm text-brand-red">Hazırlık paketini yazamadık. Tekrar dener misin?</p>}

      {!running && data.prepAttemptsLeft > 0 && (
        <button
          type="button"
          onClick={() => void create()}
          disabled={start.isPending}
          className="rounded-button bg-brand-blue px-5 py-3 font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {prep ? `Yeniden hazırla (${data.prepAttemptsLeft} hakkın kaldı)` : "Hazırlık paketini oluştur"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-brand-red dark:text-[#f87171]">
          {error}
        </p>
      )}

      {prep && <PrepSections prep={prep} practice={{ analysisId, entries: record?.practice ?? [] }} />}
    </div>
  )
}

function Flag({ issues }: { issues: Array<{ detail: string }> }) {
  return (
    <p className="m-0 mt-2 flex gap-1.5 text-sm text-brand-amber">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Kontrol et: {issues.map((i) => i.detail.replace("Bu paragrafta", "Burada")).join(" ")} Söyleyebileceğin bir şey
        değilse çıkar.
      </span>
    </p>
  )
}

export function PrepSections({ prep, practice }: { prep: InterviewPrep; practice?: { analysisId: string; entries: PracticeEntry[] } }) {
  return (
    <>
      <section className="rounded-card border border-border bg-card p-5">
        <h2 className="m-0 text-lg">Olası sorular</h2>
        <ol className="mt-4 space-y-5 pl-5">
          {prep.questions.map((q, i) => (
            <li key={i} className="text-sm">
              <p className="m-0 font-semibold">
                {q.question} <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted">{KIND_LABEL[q.kind]}</span>
              </p>
              <p className="m-0 mt-1 text-muted">{q.why}</p>
              {q.evidence.length > 0 && (
                <p className="m-0 mt-2">
                  <span className="font-medium">CV&apos;ndeki dayanağın:</span> {q.evidence.join(" · ")}
                </p>
              )}
              <dl className="m-0 mt-2 grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1 rounded-button bg-background p-3">
                <dt className="text-muted">Durum</dt>
                <dd className="m-0">{q.star.situation}</dd>
                <dt className="text-muted">Görev</dt>
                <dd className="m-0">{q.star.task}</dd>
                <dt className="text-muted">Eylem</dt>
                <dd className="m-0">{q.star.action}</dd>
                <dt className="text-muted">Sonuç</dt>
                <dd className="m-0">{q.star.result}</dd>
              </dl>
              {q.verification.status === "flagged" && <Flag issues={q.verification.issues} />}
              {practice && (
                <PracticeBox analysisId={practice.analysisId} questionIndex={i} entries={practice.entries.filter((p) => p.questionIndex === i)} />
              )}
            </li>
          ))}
        </ol>
      </section>

      {prep.consistency.length > 0 && (
        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="m-0 text-lg">Savunmaya hazır ol</h2>
          <p className="mt-1 text-sm text-muted">Görüşmeci CV&apos;ndeki bu iddiaların üstüne gidebilir.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {prep.consistency.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.claim}</span>
                <span className="block text-muted">
                  {c.reason === "quantity"
                    ? "Bu sayıyı neye göre ölçtüğünü, başlangıç noktasını ve senin payını anlatabilmelisin."
                    : "Bu maddeyi ilanın diliyle yeniden yazdık; kendi kelimelerinle ve bir örnekle anlatabilmelisin."}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {prep.bridges.length > 0 && (
        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="m-0 text-lg">Eksik kalan gereksinimler</h2>
          <p className="mt-1 text-sm text-muted">Soru gelirse sahiplenme; dürüst bir köprü kur.</p>
          <ul className="mt-3 space-y-3 text-sm">
            {prep.bridges.map((b, i) => (
              <li key={i}>
                <span className="font-medium">{b.requirement}</span>
                <span className="block">{b.answer}</span>
                {b.verification.status === "flagged" && <Flag issues={b.verification.issues} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {prep.askThem.length > 0 && (
        <section className="rounded-card border border-border bg-card p-5">
          <h2 className="m-0 text-lg">Senin soracakların</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {prep.askThem.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

const STAR_LABEL = { situation: "Durum", task: "Görev", action: "Eylem", result: "Sonuç" } as const

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length

/**
 * Yazılı pratik (DOG-97): kullanıcı cevabını yazıyor, geri bildirim STAR
 * yapısı, güçlü ve geliştirilecek yanlar, uzunluk ve "kağıtta yok". Kağıtta
 * yok kodla bulunuyor: cevaptaki sayı ya da ilan terimi CV'de yoksa.
 */
function PracticeBox({ analysisId, questionIndex, entries }: { analysisId: string; questionIndex: number; entries: PracticeEntry[] }) {
  const queryClient = useQueryClient()
  const [answer, setAnswer] = useState("")
  const [error, setError] = useState<string | null>(null)
  const send = useMutation({
    mutationFn: async () => {
      await api.post(`/applications/${encodeURIComponent(analysisId)}`, { type: "practice", questionIndex, answer })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(analysisId) }),
  })
  const latest = entries.at(-1)
  const running = latest?.status === "running"
  const used = entries.filter((e) => e.status !== "failed").length
  const left = MAX_PRACTICE_PER_QUESTION - used
  const words = countWords(answer)

  async function submit() {
    setError(null)
    try {
      await send.mutateAsync()
    } catch (e) {
      setError(await apiErrorMessage(e, "Cevabını gönderemedik. Birazdan tekrar dener misin?"))
    }
  }

  return (
    <details className="mt-3 rounded-button border border-border p-3" open={entries.length > 0}>
      <summary className="cursor-pointer font-medium text-brand-blue">Cevabını yaz, geri bildirim al</summary>
      {latest?.status === "done" && latest.feedback && <PracticeResult answer={latest.answer} feedback={latest.feedback} />}
      {latest?.status === "failed" && <p className="m-0 mt-2 text-brand-red">Cevabını değerlendiremedik. Tekrar dener misin?</p>}
      {running ? (
        <p className="m-0 mt-2 flex items-center gap-2 text-muted" role="status">
          <LoaderCircle className="size-4 text-brand-blue motion-safe:animate-spin" aria-hidden />
          Cevabını okuyoruz…
        </p>
      ) : left > 0 ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={ANSWER_MAX_LENGTH}
            rows={6}
            aria-label="Cevabın"
            placeholder="Mülakatta söyleyeceğin gibi yaz: durum, görev, ne yaptın, sonuç."
            className="w-full rounded-button border border-border bg-background p-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={send.isPending || answer.trim().length < ANSWER_MIN_LENGTH}
              className="rounded-button bg-brand-blue px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              Geri bildirim al
            </button>
            <span className="text-xs text-muted">
              {words} kelime · önerilen {ANSWER_MIN_WORDS}–{ANSWER_MAX_WORDS} · {left} hakkın kaldı
            </span>
          </div>
        </div>
      ) : (
        <p className="m-0 mt-2 text-muted">Bu soru için geri bildirim hakkın doldu.</p>
      )}
      {error && (
        <p role="alert" className="m-0 mt-2 text-brand-red dark:text-[#f87171]">
          {error}
        </p>
      )}
    </details>
  )
}

function PracticeResult({ answer, feedback }: { answer: string; feedback: NonNullable<PracticeEntry["feedback"]> }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="m-0 whitespace-pre-line rounded-button bg-background p-2 text-muted">{answer}</p>
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
        {(Object.keys(STAR_LABEL) as Array<keyof typeof STAR_LABEL>).map((k) => (
          <li key={k} className={`flex items-center gap-1 ${feedback.star[k] ? "text-brand-green" : "text-muted"}`}>
            {feedback.star[k] ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
            {STAR_LABEL[k]}
            <span className="sr-only">{feedback.star[k] ? " var" : " eksik"}</span>
          </li>
        ))}
      </ul>
      {feedback.length !== "ok" && (
        <p className="m-0 text-muted">
          {feedback.words} kelime;{" "}
          {feedback.length === "short" ? "biraz kısa, bir örnek ya da sonuç ekleyebilirsin." : "uzun, mülakatta iki dakikayı geçer; kısalt."}
        </p>
      )}
      {feedback.strengths.length > 0 && (
        <div>
          <span className="font-medium">İyi olan</span>
          <ul className="m-0 mt-1 pl-5">
            {feedback.strengths.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {feedback.improvements.length > 0 && (
        <div>
          <span className="font-medium">Geliştir</span>
          <ul className="m-0 mt-1 pl-5">
            {feedback.improvements.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {feedback.offPaper.map((t, i) => (
        <p key={i} className="m-0 flex gap-1.5 text-brand-amber">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{t}</span>
        </p>
      ))}
    </div>
  )
}
