import NARRATION from "./narration.json"
import { SEGMENTS, type Segment } from "./script"

/**
 * Kare hesabı. Her bölüm kendi cümlesi kadar sürüyor; geçiş bir önceki
 * bölümün son karelerine biniyor, ses geçiş bitince başlıyor.
 */
export const FPS = 30
export const WIDTH = 540
export const HEIGHT = 960
export const TRANSITION = 10
const LEAD = 4
const TAIL = 4
const OUTRO_HOLD = 36

export type TimedSegment = Segment & { duration: number; voiceFrom: number }

export const TIMED: TimedSegment[] = SEGMENTS.map((seg, i) => {
  const voice = Math.ceil((NARRATION as Record<string, number>)[seg.id]! * FPS)
  const voiceFrom = (i === 0 ? 0 : TRANSITION) + LEAD
  const last = i === SEGMENTS.length - 1
  return { ...seg, voiceFrom, duration: voiceFrom + voice + (last ? OUTRO_HOLD : TAIL + TRANSITION) }
})

export const TOTAL_FRAMES = TIMED.reduce((sum, s) => sum + s.duration, 0) - TRANSITION * (TIMED.length - 1)
