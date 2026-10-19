"use client"

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next"

/**
 * Vercel Web Analytics (DOG-111): çerezsiz, sayfa görüntüleme sayımı.
 * Huninin başını (ziyaret → analiz) ölçmek için; analiz sonrası adımlar
 * sunucu tarafında sayılıyor (scripts/funnel.ts).
 *
 * Sorgu parametreleri gönderilmiyor: dönüş adresleri ve analiz kimlikleri
 * (`?uyarla=…`, `?donus=…`) orada duruyor, sayım için yalnızca yol yeterli.
 */
export function stripQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url)
  url.search = ""
  url.hash = ""
  return { ...event, url: url.toString() }
}

export function WebAnalytics() {
  return <Analytics beforeSend={stripQuery} />
}
