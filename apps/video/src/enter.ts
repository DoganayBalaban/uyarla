import { spring, useCurrentFrame, useVideoConfig } from "remotion"

/** `delay` karesinden sonra 0→1 yaylı giriş. */
export function useEnter(delay: number): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping: 200 } })
}

/** Aşağıdan yükselerek belirme. */
export const rise = (p: number, px = 24) => ({ opacity: p, transform: `translateY(${(1 - p) * px}px)` })
