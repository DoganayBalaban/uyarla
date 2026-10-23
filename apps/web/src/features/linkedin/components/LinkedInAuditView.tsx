"use client"

import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { browserSendMessage, extensionIdsFromEnv, verifyHandoff } from "@/features/analysis/extensionHandoff"
import { auditQueryKey, retryAudit, startAudit, useAudit } from "@/features/linkedin/api"
import { AuditResult } from "@/features/linkedin/components/AuditResult"
import { AuditStart } from "@/features/linkedin/components/AuditStart"
import { LinkedInAuditWaiting } from "@/features/linkedin/components/LinkedInAuditWaiting"
import { EXTENSION_STORE_URL, detectExtension, readProfileHandoff } from "@/features/linkedin/handoff"
import { saveProfile } from "@/features/onboarding/api"
import { apiErrorMessage } from "@/lib/api"

/** Jetonu doğrulayabilecek eklentiler (geliştirme ve mağaza kimlikleri, DOG-71). */
const EXTENSION_IDS = extensionIdsFromEnv(process.env.NEXT_PUBLIC_EXTENSION_IDS)

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

  // Eklenti kartı: kuruluysa "Profilimi aç", değilse mağaza adresi varsa "Eklentiyi kur"; ikisi de yoksa yok.
  const [extension, setExtension] = useState<{ installed: boolean } | null>(null)
  useEffect(() => {
    void detectExtension(EXTENSION_IDS, browserSendMessage()).then((installed) =>
      setExtension(installed ? { installed: true } : EXTENSION_STORE_URL ? { installed: false } : null),
    )
  }, [])

  // Eklentiden gelen profil (DOG-157): # siliniyor, jeton eklentiye doğrulatılıyor, tarama başlıyor.
  const handoffDone = useRef(false)
  useEffect(() => {
    if (handoffDone.current) return
    const incoming = readProfileHandoff(window.location.hash)
    if (!incoming) return
    handoffDone.current = true
    window.history.replaceState(null, "", window.location.pathname)
    if ("error" in incoming) {
      setError("Eklentiden gelen profil okunamadı. Sayfayı yenileyip eklentiye yeniden tıkla ya da PDF yükle.")
      return
    }
    void (async () => {
      const valid = await verifyHandoff(incoming.token, EXTENSION_IDS, browserSendMessage())
      if (!valid) {
        setError("Eklentiden gelen profili doğrulayamadık. LinkedIn'de eklentiye yeniden tıkla.")
        return
      }
      setBusy(true)
      try {
        await startAudit({ source: "extension", profile: incoming.profile, targetRole, analysisIds: [] })
        setRestart(false)
        await queryClient.invalidateQueries({ queryKey: auditQueryKey })
      } catch (e) {
        setError(await apiErrorMessage(e, "Taramayı başlatamadık. Birazdan tekrar dener misin?"))
      } finally {
        setBusy(false)
      }
    })()
    // İlk açılışta bir kez; targetRole o anki değer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const startPanel = <AuditStart targetRole={targetRole} extension={extension} busy={busy} error={error} onStart={start} onTargetRoleSave={saveRole} />

  if (!current || restart) return startPanel
  if (current.status === "failed" || (current.status === "done" && !current.report)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">Profilini denetleyemedik. Tekrar dener misin?</p>
        {startPanel}
      </div>
    )
  }
  // Başlangıç paneli dışında da hata görünsün (ör. eklentiden gelen profil, bitmiş bir taramanın üstünde).
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {current.status === "running" ? (
        <LinkedInAuditWaiting audit={current} />
      ) : (
        <AuditResult audit={current} previous={data?.previous ?? null} unlocked={data?.unlocked ?? false} onRescan={() => setRestart(true)} onRetry={() => void retry(current.id)} />
      )}
    </div>
  )
}
