"use client"

import { animate, motion, useInView, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

/**
 * Ortak hareket yardımcıları (DOG-143). Abartısız: kısa fade ve küçük kayma.
 * Hareket azaltmayı seçen kullanıcıda hepsi hareketsiz; içerik hemen görünür.
 */

const EASE = [0.22, 1, 0.36, 1] as const

/** İçeriği kısa bir fade ve 8px yukarı kayma ile getirir. */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Çocukları sırayla getirir; listeler ve kart ızgaraları için. */
export function Stagger({ children, className, step = 0.05 }: { children: React.ReactNode; className?: string; step?: number }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{ hidden: {}, shown: { transition: { staggerChildren: step } } }}
    >
      {children}
    </motion.div>
  )
}

/** `Stagger` içindeki tek öge. */
export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 8 }, shown: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } }}
    >
      {children}
    </motion.div>
  )
}

/** Sayıyı görünür olunca 0'dan sayar; özet kartları için. */
export function CountUp({ value, className, duration = 0.8 }: { value: number; className?: string; duration?: number }) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const [shown, setShown] = useState(reduced ? value : 0)

  useEffect(() => {
    if (reduced) {
      setShown(value)
      return
    }
    if (!inView) return
    const controls = animate(0, value, { duration, ease: EASE, onUpdate: (v) => setShown(Math.round(v)) })
    return () => controls.stop()
  }, [value, inView, reduced, duration])

  return (
    <span ref={ref} className={className}>
      {shown.toLocaleString("tr-TR")}
    </span>
  )
}
