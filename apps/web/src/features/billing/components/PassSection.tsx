"use client"

import { AccessStatus } from "@/features/billing/components/AccessStatus"

/** Hesabım'da kalan haklar ve erişim dönemi (DOG-81). */
export function PassSection() {
  return (
    <section className="rounded-card border border-border bg-card p-6">
      <h2 className="m-0 text-lg">Erişim dönemi</h2>
      <AccessStatus className="mt-4 border-0 p-0" />
    </section>
  )
}
