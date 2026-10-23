"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { auditQueryKey, retryAudit, startAudit, useAudit } from "@/features/linkedin/api"
import { AuditResult } from "@/features/linkedin/components/AuditResult"
import { AuditStart } from "@/features/linkedin/components/AuditStart"
import { LinkedInAuditWaiting } from "@/features/linkedin/components/LinkedInAuditWaiting"
import { saveProfile } from "@/features/onboarding/api"
import { apiErrorMessage } from "@/lib/api"

/**
 * LinkedIn profil denetimi sayfası (DOG-157, spec §5.1): başlangıç, bekleme,
 * sonuç. Hedef rol profilden; sayfada değişince profil de güncelleniyor.
 */
export function LinkedInAuditView({ initialTargetRole }: { initialTargetRole: string | null }) {
  const queryClient = useQueryClient()
  const audit = useAudit()
  const [targetRole, setTargetRole] = useState(initialTargetRole)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restart, setRestart] = useState(false)

  async function start(body: { resumeId: string; targetRole: string | null; analysisIds: string[] }) {
    setBusy(true)
    setError(null)
    try {
      await startAudit({ source: "pdf", ...body })
      setRestart(false)
      await queryClient.invalidateQueries({ queryKey: auditQueryKey })
    } catch (e) {
      setError(await apiErrorMessage(e, "Taramayı başlatamadık. Birazdan tekrar dener misin?"))
    } finally {
      setBusy(false)
    }
  }

  async function saveRole(role: string) {
    await saveProfile({ targetRole: role })
    setTargetRole(role)
  }

  async function retry(id: string) {
    try {
      await retryAudit(id)
      await queryClient.invalidateQueries({ queryKey: auditQueryKey })
    } catch (e) {
      setError(await apiErrorMessage(e, "Yeniden deneyemedik."))
    }
  }

  if (audit.isPending) return <Skeleton className="h-64 rounded-xl" />
  const data = audit.data
  const current = data?.audit ?? null
  const startPanel = <AuditStart targetRole={targetRole} extension={null} busy={busy} error={error} onStart={start} onTargetRoleSave={saveRole} />

  if (!current || restart) return startPanel
  if (current.status === "running") return <LinkedInAuditWaiting audit={current} />
  if (current.status === "failed" || !current.report) {
    return (
      <div className="space-y-4">
        <p className="m-0 text-sm text-destructive">Profilini denetleyemedik. Tekrar dener misin?</p>
        {startPanel}
      </div>
    )
  }
  return <AuditResult audit={current} previous={data?.previous ?? null} unlocked={data?.unlocked ?? false} onRescan={() => setRestart(true)} onRetry={() => void retry(current.id)} />
}
