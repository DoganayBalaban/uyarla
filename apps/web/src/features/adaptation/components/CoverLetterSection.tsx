"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  Check,
  Copy,
  Download,
  LoaderCircle,
  Mail,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react"
import type { CoverLetterChecks } from "@uyarla/core/cover/checks"
import type { CoverLetterRecord } from "@uyarla/core/cover/letter"
import { apiErrorMessage } from "@/lib/api"
import { cn } from "@/lib/cn"
import { adaptationQueryKey, requestCoverLetter } from "@/features/adaptation/api"
import type { AdaptationState } from "@/features/adaptation/types"

/**
 * Uyarlama ekranındaki ön yazı bölümü.
 *
 * Kayıt uyarlama sorgusundan geliyor (`letter`); o sorgu ön yazı sürerken
 * yoklamaya devam ediyor. Yeni istek yanıtı aynı önbelleğe yazılıyor.
 */
export function CoverLetterSection({
  adaptationId,
  letter: record,
  checks = null,
}: {
  adaptationId: string
  letter: CoverLetterRecord | null
  /** Kontrol listesi (DOG-96); sunucu ön yazı bitince hesaplıyor. */
  checks?: CoverLetterChecks | null
}) {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function create() {
    setErrorMessage(null)
    setCopied(false)
    try {
      const { coverLetter } = await requestCoverLetter(adaptationId)
      queryClient.setQueryData<AdaptationState>(adaptationQueryKey(adaptationId), (d) => (d ? { ...d, coverLetter } : d))
    } catch (error) {
      setErrorMessage(await apiErrorMessage(error, "Ön yazıyı başlatamadık. Birazdan tekrar dener misin?"))
    }
  }

  const running = record?.status === "running"

  const bodyText =
    record?.status === "done" ? record.paragraphs.map((p) => p.text).join("\n\n") : ""
  const flaggedCount = record?.status === "done" ? record.paragraphs.filter((p) => p.verification.status === "flagged").length : 0

  async function copy() {
    await navigator.clipboard.writeText(bodyText)
    setCopied(true)
  }

  function downloadFile() {
    const url = URL.createObjectURL(new Blob([bodyText], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "uyarla-on-yazi.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-button bg-brand-blue/10 text-brand-blue">
            <Mail className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="m-0 text-base font-semibold">Ön yazı</h2>
            <p className="m-0 mt-0.5 text-sm text-muted-foreground">
              Bu ilana ve CV&apos;ndeki gerçek deneyimine özel, üç paragraflık bir ön yazı.
            </p>
          </div>
        </div>
        {record?.status !== "running" && (
          <button
            type="button"
            onClick={() => void create()}
            className={cn(
              "inline-flex items-center gap-2 rounded-button px-4 py-2.5 text-sm font-semibold transition",
              record?.status === "done"
                ? "border border-border hover:border-brand-blue/40 hover:text-brand-blue"
                : "bg-brand-blue text-white shadow-sm shadow-brand-blue/30 hover:bg-brand-blue/90",
            )}
          >
            {record?.status === "done" ? (
              <RefreshCw className="size-4" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {record?.status === "done" ? "Yeniden yaz" : "Ön yazı oluştur"}
          </button>
        )}
      </div>

      {errorMessage && (
        <p role="alert" className="mt-3 text-sm text-brand-red dark:text-[#f87171]">
          {errorMessage}
        </p>
      )}

      {running && (
        <div className="mt-5 space-y-2.5" role="status">
          <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 text-brand-blue motion-safe:animate-spin" aria-hidden />
            Ön yazını yazıyoruz, sonra hiçbir şeyin uydurulmadığını kontrol ediyoruz…
          </p>
          {/* İskelet: metnin geleceği yerin kabaca şekli. */}
          {[92, 100, 78].map((w) => (
            <div
              key={w}
              aria-hidden
              className="h-3 rounded-full bg-background motion-safe:animate-pulse"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      )}

      {record?.status === "failed" && (
        <p className="mt-4 text-sm text-brand-red dark:text-[#f87171]">
          Ön yazıyı yazamadık. “Ön yazı oluştur” ile tekrar dener misin?
        </p>
      )}

      {record?.status === "done" && (
        <>
          {flaggedCount > 0 && (
            <p className="mt-4 flex gap-2 rounded-button bg-brand-amber/10 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-hidden />
              <span>
                {flaggedCount} paragrafta CV&apos;nde olmayan bir bilgi olabilir. Kullanmadan önce işaretli
                yerleri düzelt ya da çıkar.
              </span>
            </p>
          )}
          <div className="mt-4 space-y-2 rounded-button border border-border bg-background/60 p-2 sm:p-3">
            {record.paragraphs.map((p, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-[8px] p-3",
                  p.verification.status === "flagged" && "border border-brand-amber/40 bg-brand-amber/5",
                )}
              >
                {p.verification.status === "flagged" && (
                  <>
                    <span className="mb-1.5 inline-block rounded-full bg-brand-amber/20 px-2 py-0.5 text-xs font-bold text-brand-amber">
                      Kontrol et
                    </span>
                    {p.verification.issues.map((s, j) => (
                      <p key={j} className="m-0 mb-1.5 text-sm text-brand-amber">
                        {s.detail}
                      </p>
                    ))}
                  </>
                )}
                <p className="m-0 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
          {checks && <LetterChecklist checks={checks} />}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-2 rounded-button bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-blue/30 transition hover:bg-brand-blue/90"
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Kopyalandı" : "Metni kopyala"}
            </button>
            <button
              type="button"
              onClick={downloadFile}
              className="inline-flex items-center gap-2 rounded-button border border-border px-4 py-2.5 text-sm font-semibold transition hover:border-brand-blue/40 hover:text-brand-blue"
            >
              <Download className="size-4" aria-hidden />
              Metin olarak indir
            </button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Yapay zekâ ile yazıldı ve CV&apos;ndeki bilgilerle karşılaştırıldı. Göndermeden önce
            okuyup kendi sesine göre düzenle.
          </p>
        </>
      )}
    </section>
  )
}

/**
 * Ön yazının altında kısa kontrol listesi (DOG-96): şirket adı, unvan,
 * uzunluk, klişe. Öneri; göndermeyi engellemiyor.
 */
export function LetterChecklist({ checks }: { checks: CoverLetterChecks }) {
  const rows: Array<{ ok: boolean; text: string; examples?: string[] }> = []
  if (checks.company) {
    rows.push({
      ok: checks.company.mentioned,
      text: checks.company.mentioned ? `Şirket adı geçiyor (${checks.company.name})` : `Şirket adı geçmiyor (${checks.company.name})`,
    })
  }
  if (checks.title) {
    rows.push({
      ok: checks.title.mentioned,
      text: checks.title.mentioned ? "İlandaki unvan geçiyor" : `İlandaki unvan geçmiyor (${checks.title.position})`,
    })
  }
  rows.push({
    ok: checks.length === "ok",
    text:
      checks.length === "ok"
        ? `Uzunluk uygun (${checks.words} kelime)`
        : checks.length === "short"
          ? `Kısa (${checks.words} kelime); 150–250 kelime öneriliyor`
          : `Uzun (${checks.words} kelime); 150–250 kelime öneriliyor`,
  })
  rows.push(
    checks.cliches.length === 0
      ? { ok: true, text: "Klişe ya da olumsuz ifade yok" }
      : {
          ok: false,
          text: `Klişe ya da olumsuz ifade: ${checks.cliches.map((c) => `“${c.phrase}”`).join(", ")}. Yerine somut bir deneyim yaz.`,
        },
  )
  return (
    <ul className="mt-4 space-y-1.5 text-sm" aria-label="Ön yazı kontrol listesi">
      {rows.map((row, i) => (
        <li key={i} className="flex items-start gap-2">
          {row.ok ? (
            <Check className="mt-0.5 size-4 shrink-0 text-brand-green" aria-hidden />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-hidden />
          )}
          <span className={row.ok ? "text-muted-foreground" : undefined}>{row.text}</span>
        </li>
      ))}
    </ul>
  )
}
