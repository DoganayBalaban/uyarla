import { useQuery } from "@tanstack/react-query"
import type { PlanKey } from "@/features/billing/plans"
import { api } from "@/lib/api"

export async function createCheckout(plan: PlanKey, returnTo: string | null): Promise<{ url: string }> {
  return (await api.post<{ url: string }>("/billing/checkout", { plan, returnTo })).data
}

export interface BillingStatus {
  passEndsAt: string | null
  freeUsed: boolean
  /** Kalan ücretsiz uyarlama (DOG-81). */
  freeLeft: number
  /** Son 24 saatteki uyarlamalar; günlük sınır yalnız dönem içinde işliyor. */
  usedLast24h: number
  dailyCap: number
}

export const billingStatusKey = ["billing-status"] as const

/** Dönem durumu; teşekkür sayfası dönem açılana kadar yokluyor. */
export function useBillingStatus(options: { pollMs?: number; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: billingStatusKey,
    queryFn: async () => (await api.get<BillingStatus>("/billing/status")).data,
    enabled: options.enabled ?? true,
    refetchInterval: (query) => (options.pollMs && !query.state.data?.passEndsAt ? options.pollMs : false),
  })
}
