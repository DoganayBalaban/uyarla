import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { AuditRequest, AuditResponse } from "@/features/linkedin/audit"

export const auditQueryKey = ["linkedin-audit"] as const

export async function getAudit(): Promise<AuditResponse> {
  return (await api.get<AuditResponse>("/linkedin/audits")).data
}

/** Tarama sürerken 2 saniyede bir yokluyor; bitince duruyor. */
export function useAudit() {
  return useQuery({
    queryKey: auditQueryKey,
    queryFn: getAudit,
    refetchInterval: (q) => (q.state.data?.audit?.status === "running" ? 2000 : false),
  })
}

export async function startAudit(body: AuditRequest): Promise<{ auditId: string }> {
  return (await api.post<{ auditId: string }>("/linkedin/audits", body)).data
}

/** Denetim sayfasından doğrudan LinkedIn PDF'i (DOG-166); CV kütüphanesine girmiyor. */
export async function startAuditUpload(file: File, body: { targetRole: string | null; analysisIds: string[] }): Promise<{ auditId: string }> {
  const form = new FormData()
  form.append("file", file)
  if (body.targetRole) form.append("targetRole", body.targetRole)
  form.append("analysisIds", JSON.stringify(body.analysisIds))
  return (await api.post<{ auditId: string }>("/linkedin/audits", form)).data
}

export async function retryAudit(id: string): Promise<void> {
  await api.patch("/linkedin/audits", { id, action: "retry" })
}
