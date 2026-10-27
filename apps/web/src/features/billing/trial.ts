import type { BillingStatus } from "@/features/billing/api"
import { formatDay, timeLeft } from "@/features/billing/format"

const URGENT_MS = 2 * 864e5

/** Uygulamanın üstündeki deneme şeridi (DOG-158, spec §5); denemede değilse null. */
export function trialBanner(status: BillingStatus, now: Date): { text: string; urgent: boolean } | null {
  const sub = status.subscription
  if (!sub || sub.status !== "trialing" || !sub.trialEnd) return null
  const urgent = new Date(sub.trialEnd).getTime() - now.getTime() <= URGENT_MS
  if (sub.cancelAtPeriodEnd) return { text: `Deneme ${formatDay(sub.trialEnd)} tarihinde bitiyor; ücret çekilmeyecek`, urgent }
  const charge = sub.priceTry !== null ? `${sub.priceTry} ₺` : "paket ücreti"
  return { text: `Deneme: ${timeLeft(sub.trialEnd, now)} · ${formatDay(sub.trialEnd)} tarihinde ${charge} çekilecek`, urgent }
}
