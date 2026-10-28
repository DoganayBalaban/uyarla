"use client"

import { useEffect, useState } from "react"
import type { StepId } from "@/features/landing/journey"
import s from "@/features/landing/landing.module.css"

/**
 * Yolculuk şeridi (DOG-160): altı adım, her biri kendi bölümüne bağlantı.
 * Görünen bölüm vurgulanıyor. Dar ekranda şerit kendi içinde kayıyor.
 */
export function JourneyRail({ steps }: { steps: { id: StepId; number: string; name: string }[] }) {
  const [active, setActive] = useState<StepId | null>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id as StepId)
      },
      { rootMargin: "-30% 0px -60% 0px" },
    )
    for (const step of steps) {
      const el = document.getElementById(step.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [steps])

  // Dar ekranda etkin adım şeridin görünen yerine kaysın.
  useEffect(() => {
    if (!active) return
    document.querySelector(`#yolculuk a[href="#${active}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [active])

  return (
    <nav id="yolculuk" aria-label="Başvuru yolculuğu" className={s.journeyRail}>
      <ol className={s.journeyRailList}>
        {steps.map((step) => (
          <li key={step.id}>
            <a
              href={`#${step.id}`}
              aria-current={active === step.id ? "step" : undefined}
              className={`${s.journeyRailStep} ${active === step.id ? s.journeyRailStepActive : ""}`}
            >
              <span className={s.journeyRailNumber}>{step.number}</span>
              {step.name}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
