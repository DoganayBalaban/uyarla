import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { PlanKey } from "@/features/billing/plans"
import { api } from "@/lib/api"

export async function createCheckout(plan: PlanKey, returnTo: string | null): Promise<{ url: string }> {
  return (await api.post<{ url: string }>("/billing/checkout", { plan, returnTo })).data
}

export interface BillingStatus {
  passEndsAt: string | null
  /** En son açılan aktif dönemin oluşturulma zamanı (DOG-80); eski yanıtlarda yok. */
  lastPassAt?: string | null
  freeUsed: boolean
  /** Kalan ücretsiz uyarlama (DOG-81). */
  freeLeft: number
  /** Son 24 saatteki uyarlamalar; günlük sınır yalnız dönem içinde işliyor. */
  usedLast24h: number
  dailyCap: number
  /** Yönetici hesabı: ödeme duvarı ve günlük tavan yok. Eski yanıtlarda yok. */
  unlimited?: boolean
}

export const billingStatusKey = ["billing-status"] as const

/**
 * Dönem durumu. `poll` verilirse `until` doğru olana kadar yokluyor; teşekkür
 * sayfası ödeme bildirimini böyle bekliyor. `poll` aralığı geçen süreye göre
 * veriyor; false dönünce yoklama duruyor (DOG-80: ödeme hiç gelmezse sonsuza
 * dek sorgulamasın).
 */
export function useBillingStatus(
  options: {
    enabled?: boolean
    poll?: (elapsedMs: number) => number | false
    until?: (status: BillingStatus) => boolean
  } = {},
) {
  const [startedAt] = useState(() => Date.now())
  return useQuery({
    queryKey: billingStatusKey,
    queryFn: async () => (await api.get<BillingStatus>("/billing/status")).data,
    enabled: options.enabled ?? true,
    refetchInterval: (query) => {
      if (!options.poll) return false
      const data = query.state.data
      if (data && options.until?.(data)) return false
      return options.poll(Date.now() - startedAt)
    },
  })
}
