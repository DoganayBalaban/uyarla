import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { PlanKey } from "@/features/billing/plans"
import { api } from "@/lib/api"

export async function createCheckout(plan: PlanKey, returnTo: string | null): Promise<{ url: string }> {
  return (await api.post<{ url: string }>("/billing/checkout", { plan, returnTo })).data
}

/** `GET /api/billing/status` (DOG-158): abonelik ve ücretsiz kota. */
export interface BillingStatus {
  /** Abonelik ya da yönetici: ücretli özellikler açık. */
  access: boolean
  /** Yönetici hesabı: kota ve günlük tavan yok. */
  unlimited: boolean
  /** Hiç aboneliği olmamış: düğme "7 gün ücretsiz başla". */
  trialEligible: boolean
  subscription: {
    plan: string
    status: string
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
    trialEnd: string | null
    createdAt: string
    /** Paket ekranındaki fiyat (yenilemede çekilecek tutar); yapılandırmada yoksa null. */
    priceTry: number | null
  } | null
  /** Ücretsiz kullanıcıda bu ayki kota; abonede ve yöneticide null. */
  quota: { analyses: { used: number; limit: number }; adaptations: { used: number; limit: number }; resetsAt: string } | null
  /** Son 24 saatteki uyarlamalar; günlük tavan yalnız abonelikte işliyor. */
  usedLast24h: number
  dailyCap: number
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
