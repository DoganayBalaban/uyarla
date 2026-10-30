import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import { forgetAccountData } from "@/features/account/api"
import { billingStatusKey } from "@/features/billing/api"

describe("forgetAccountData", () => {
  it("empties what an open screen still shows, not only the cache", () => {
    // Deneme bandı ekranda açıkken hesap silinince "599 ₺ çekilecek" kalıyordu:
    // clear() önbelleği boşaltıyor ama açık gözlemciye haber vermiyor.
    const client = new QueryClient()
    client.setQueryData(billingStatusKey, { trialEnd: "2026-11-05T00:00:00Z" })
    const banner = new QueryObserver(client, { queryKey: billingStatusKey, enabled: false })
    const unsubscribe = banner.subscribe(() => {})
    forgetAccountData(client)
    expect(banner.getCurrentResult().data ?? null).toBeNull()
    expect(client.getQueryCache().getAll()).toHaveLength(0)
    unsubscribe()
  })
})
