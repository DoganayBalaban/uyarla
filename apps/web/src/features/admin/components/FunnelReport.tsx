import type { FunnelStepKey, FunnelSummary } from "@/server/funnel"

const STEP_LABEL: Record<FunnelStepKey, string> = {
  analyzed: "Analiz tamamlandı",
  registered: "Kayıt oldu",
  adapted: "Uyarlama başlattı",
  downloaded: "CV'yi indirdi",
}

const percent = (value: number) => `%${Math.round(value * 100)}`

/** Bir dönemin hunisi ve analiz sağlığı (DOG-62). */
export function FunnelReport({ title, summary }: { title: string; summary: FunnelSummary }) {
  const { steps, analyses, medianDurationMs } = summary
  return (
    <section aria-label={title} className="rounded-card border border-border bg-card">
      <h2 className="m-0 px-5 pt-4 pb-3 text-base font-bold">{title}</h2>
      <table className="w-full border-t border-border text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="px-5 py-2 font-medium">Adım</th>
            <th className="px-5 py-2 text-right font-medium">Kişi</th>
            <th className="px-5 py-2 text-right font-medium">Önceki adımdan</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.key} className="border-t border-border">
              <td className="px-5 py-2.5">{STEP_LABEL[s.key]}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">{s.users}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">
                {s.fromPrevious === null ? "—" : percent(s.fromPrevious)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 border-t border-border px-5 py-3 text-sm text-muted">
        {analyses.total} analiz · {analyses.failed} başarısız ({percent(analyses.failureRate)}) · medyan süre{" "}
        {medianDurationMs === null ? "—" : `${(medianDurationMs / 1000).toFixed(1)} sn`} · örnek ilanla {analyses.sample}
      </p>
    </section>
  )
}
