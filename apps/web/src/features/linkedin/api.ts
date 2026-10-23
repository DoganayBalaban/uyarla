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

export async function retryAudit(id: string): Promise<void> {
  await api.patch("/linkedin/audits", { id, action: "retry" })
}
