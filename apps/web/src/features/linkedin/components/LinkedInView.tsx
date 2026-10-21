"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, CircleCheck, Copy, TriangleAlert } from "lucide-react"
import {
  ABOUT_TARGET_WORDS,
  HEADLINE_MAX_CHARS,
  MAX_REPORT_POSTINGS,
  type LinkedInReport,
  type LinkedInReportRecord,
  type LinkedInSuggestion,
} from "@uyarla/core/linkedin/reportRecord"
import { api, apiErrorMessage } from "@/lib/api"
import { useLibrary } from "@/features/resumes/api"
import { useApplicationCards } from "@/features/applications/api"
import { PageHeader } from "@/components/layout/PageShell"
import { StageTimeline } from "@/features/analysis/components/StageTimeline"
import { deriveStageStates } from "@/features/analysis/stageStates"

/** Raporun gerçek adımları (DOG-136); hangisinde olduğunu worker kayda yazıyor. */
const REPORT_STAGES = [
  { id: "reading", title: "Profilini okuyoruz", description: "LinkedIn PDF'indeki deneyim, beceri ve Hakkında bölümü ayrıştırılıyor." },
  { id: "scoring", title: "İlanlarla karşılaştırıyoruz", description: "Seçtiğin her ilanın gereksinimleri profilinde aranıyor." },
  { id: "writing", title: "Başlık ve Hakkında önerisi yazıyoruz", description: "Öneri, profilinde yazanlara karşı kontrol ediliyor." },
]

const reportKey = (resumeId: string) => ["linkedin-report", resumeId] as const

/**
 * LinkedIn profil raporu (DOG-69). Kullanıcı LinkedIn'de profilini PDF olarak
 * indirip kütüphanesine yüklüyor; profil sayfası sunucudan çekilmiyor. Rapor
 * profile dokunmuyor: kullanıcı önerileri LinkedIn'de kendisi uyguluyor.
 */
export function LinkedInView() {
  const library = useLibrary(true)
  const cards = useApplicationCards()
  const queryClient = useQueryClient()
  const [resumeId, setResumeId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const resumes = library.data ?? []
  const chosen = resumeId ?? resumes.find((r) => /linkedin/i.test(`${r.label ?? ""} ${r.fileName ?? ""}`))?.id ?? resumes[0]?.id ?? null
  const report = useQuery({
    queryKey: reportKey(chosen ?? "-"),
    enabled: !!chosen,
    queryFn: async () => (await api.get<{ linkedinReport: LinkedInReportRecord | null }>(`/resumes/${encodeURIComponent(chosen!)}`)).data.linkedinReport,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 2500 : false),
  })
  const start = useMutation({
    mutationFn: async () => {
      await api.post(`/resumes/${encodeURIComponent(chosen!)}`, { type: "linkedin-report", analysisIds: picked })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportKey(chosen!) }),
  })

  const analyses = (cards.data ?? []).slice(0, 20)
  const record = report.data ?? null
  // Uçla aynı kural: 10 dakikadan eski "running" takılmış sayılıyor.
  const running = record?.status === "running" && Date.now() - Date.parse(record.createdAt) < 10 * 60_000

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_REPORT_POSTINGS ? [...p, id] : p))
  }

  async function create() {
    setError(null)
    try {
      await start.mutateAsync()
    } catch (e) {
      setError(await apiErrorMessage(e, "Raporu başlatamadık. Birazdan tekrar dener misin?"))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="LinkedIn profilin"
        description="Profilini hedeflediğin ilanlarla karşılaştır: eksik kalan beceriler, başlık ve “Hakkında” kontrolleri. Profiline dokunmuyoruz; önerileri LinkedIn'de sen uygularsın."
      />

      <section className="rounded-card border border-border bg-card p-5 text-sm">
        <h2 className="m-0 text-base">1. Profilinin PDF'i</h2>
        <p className="mt-1 text-muted">
          LinkedIn'de profiline git, <span className="font-medium text-foreground">Daha fazla → PDF olarak kaydet</span> de ve
          dosyayı{" "}
          <Link href="/account" className="font-medium text-brand-blue">
            CV kütüphanene
          </Link>{" "}
          yükle.
        </p>
        {resumes.length > 0 ? (
          <select
            value={chosen ?? ""}
            onChange={(e) => setResumeId(e.target.value)}
            aria-label="LinkedIn PDF'in"
            className="mt-3 w-full rounded-button border border-border bg-background px-2 py-1.5"
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label || r.fileName || "CV"}
              </option>
            ))}
          </select>
        ) : (
          !library.isPending && <p className="mt-3 text-brand-amber">Kütüphanende CV yok.</p>
        )}
      </section>

      <section className="rounded-card border border-border bg-card p-5 text-sm">
        <h2 className="m-0 text-base">2. Hedeflediğin ilanlar</h2>
        <p className="mt-1 text-muted">Daha önce analiz ettiğin ilanlardan en fazla {MAX_REPORT_POSTINGS} tanesini seç.</p>
        {analyses.length > 0 ? (
          <ul className="mt-3 space-y-1.5 pl-0">
            {analyses.map((c) => (
              <li key={c.analysisId} className="list-none">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={picked.includes(c.analysisId)}
                    disabled={!picked.includes(c.analysisId) && picked.length >= MAX_REPORT_POSTINGS}
                    onChange={() => toggle(c.analysisId)}
                    className="size-4 accent-brand-blue"
                  />
                  <span>
                    {c.position}
                    {c.company && <span className="text-muted"> · {c.company}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          !cards.isPending && (
            <p className="mt-3 text-muted">
              Henüz analizin yok.{" "}
              <Link href="/analyze" className="font-medium text-brand-blue">
                Bir ilanı ölç
              </Link>
              , sonra buraya dön.
            </p>
          )
        )}
        <button
          type="button"
          onClick={() => void create()}
          disabled={!chosen || picked.length === 0 || running || start.isPending}
          className="mt-4 rounded-button bg-brand-blue px-5 py-2.5 font-semibold text-white disabled:opacity-50"
        >
          {record?.status === "done" ? "Raporu yenile" : "Raporu hazırla"}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-brand-red dark:text-[#f87171]">
            {error}
          </p>
        )}
      </section>

      {running && record?.status === "running" && (
        <StageTimeline
          heading="Raporun hazırlanıyor"
          subtitle="Genelde bir dakika kadar sürüyor."
          stages={deriveStageStates(REPORT_STAGES, record.stage ?? null)}
        />
      )}
      {record?.status === "failed" && <p className="text-sm text-brand-red">Raporu hazırlayamadık. Tekrar dener misin?</p>}
      {record?.status === "done" && <ReportView report={record.report} />}
    </div>
  )
}

export function ReportView({ report }: { report: LinkedInReport }) {
  return (
    <>
      {report.suggestions && (
        <section className="rounded-card border border-border bg-card p-5 text-sm">
          <h2 className="m-0 text-base">Öneriler</h2>
          <p className="mt-1 text-muted">
            Yalnızca profilinde yazanlarla; başlığa yalnızca profilinde geçen beceriler giriyor. Kopyalayıp LinkedIn'de kendin
            güncelle.
          </p>
          <SuggestionBlock
            title="Başlık"
            current={report.headline}
            suggestion={report.suggestions.headline}
            measure={(t) => `${t.length}/${HEADLINE_MAX_CHARS} karakter`}
          />
          <SuggestionBlock
            title="Hakkında"
            current={report.about}
            suggestion={report.suggestions.about}
            measure={(t) => `${t.split(/\s+/).filter(Boolean).length} kelime · önerilen ${ABOUT_TARGET_WORDS.min}–${ABOUT_TARGET_WORDS.max}`}
          />
        </section>
      )}
      <section className="rounded-card border border-border bg-card p-5 text-sm">
        <h2 className="m-0 text-base">Profil kontrolleri</h2>
        <ul className="mt-3 space-y-2 pl-0">
          {report.checks.map((c) => (
            <li key={c.id} className="flex list-none gap-2">
              {c.status === "ok" ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-hidden />
              )}
              <span>{c.text}</span>
            </li>
          ))}
        </ul>
        {report.headline && (
          <p className="m-0 mt-3 text-muted">
            Şu anki başlığın: <span className="text-foreground">{report.headline}</span>
          </p>
        )}
      </section>

      <section className="rounded-card border border-border bg-card p-5 text-sm">
        <h2 className="m-0 text-base">İlanlarda geçen, profilinde görünmeyenler</h2>
        <p className="mt-1 text-muted">
          {report.postings.length > 1 ? "Seçtiğin ilanların en az ikisinde isteniyor." : "Seçtiğin ilanda isteniyor."} Deneyiminde varsa
          profiline ekle; yoksa ekleme.
        </p>
        {report.commonMissing.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5 pl-0">
            {report.commonMissing.map((m) => (
              <li key={m.term} className="list-none rounded-full border border-border bg-background px-2.5 py-0.5">
                {m.term}
                {m.must && <span className="ml-1 text-xs text-brand-amber">zorunlu</span>}
                {report.postings.length > 1 && <span className="ml-1 text-xs text-muted">{m.postings} ilanda</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3">Ortak bir eksik görünmüyor.</p>
        )}
        <p className="m-0 mt-3 text-xs text-muted">
          Karşılaştırılan ilanlar: {report.postings.map((p) => `${p.position}${p.company ? ` (${p.company})` : ""}`).join(", ")}
        </p>
      </section>
    </>
  )
}

function SuggestionBlock({
  title,
  current,
  suggestion,
  measure,
}: {
  title: string
  current: string | null
  suggestion: LinkedInSuggestion
  measure: (text: string) => string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-4">
      <h3 className="m-0 text-sm font-semibold">{title}</h3>
      {current && <p className="m-0 mt-1 text-xs text-muted">Şu anki: {current}</p>}
      <p className="m-0 mt-2 whitespace-pre-line rounded-button bg-background p-2.5 leading-relaxed">{suggestion.text}</p>
      {suggestion.verification.status === "flagged" && (
        <p className="m-0 mt-2 flex gap-1.5 text-brand-amber">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Kontrol et: {suggestion.verification.issues.map((i) => i.detail).join(" ")}</span>
        </p>
      )}
      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
        <span>{measure(suggestion.text)}</span>
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(suggestion.text).then(() => setCopied(true))}
          className="inline-flex items-center gap-1 font-semibold text-brand-blue"
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>
    </div>
  )
}
