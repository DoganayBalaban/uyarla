import { fade } from "@remotion/transitions/fade"
import { linearTiming, TransitionSeries } from "@remotion/transitions"
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion"
import { INTERVIEWER_NAME } from "@uyarla/core/interview/simulationRecord"
import { UyarlaLogo } from "@/components/brand/UyarlaMark"
import { loopMs } from "@/features/landing/demos/demoScript"
import { SIMULATION_PHASES, type SimulationPhase } from "@/features/landing/demos/scenes"
import { SimulationFilm } from "@/features/landing/demos/SimulationDemo"
import s from "@/features/landing/landing.module.css"
import { rise, useEnter } from "./enter"
import { FPS, TRANSITION } from "./timing"

/**
 * Mülakat simülasyonu videosu (DOG-173), 9:16, sessiz. Sahne tanıtım
 * sayfasındaki filmin kendisi (SimulationFilm): kare → ms → aynı kare.
 * Ses yok; filmin altındaki satır o an ne olduğunu söylüyor. TikTok'un üst
 * (~%7) ve alt (~%20) arayüzü için o bantlar boş (Tanitim ile aynı).
 */

const INTRO = 66
const FILM = Math.ceil((loopMs(SIMULATION_PHASES) / 1000) * FPS)
const OUTRO = 84
const timing = linearTiming({ durationInFrames: TRANSITION, easing: Easing.inOut(Easing.cubic) })

export const SIMULASYON_FRAMES = INTRO + FILM + TRANSITION + OUTRO

/** Filmin altındaki satır: aşamaya göre ürünün o an yaptığı şey. */
const CAPTION: Record<SimulationPhase, string> = {
  opening: `${INTERVIEWER_NAME} ilanı ve CV'ni bilerek soruyor.`,
  question: `${INTERVIEWER_NAME} ilanı ve CV'ni bilerek soruyor.`,
  answer: "Sen mülakatta söyleyeceğin gibi cevaplıyorsun.",
  typing: "CV'nde olmayan bir iddia mı?",
  probe: `${INTERVIEWER_NAME} gerçek bir görüşmeci gibi üstüne gidiyor.`,
  report: "Sonunda her cevabına geri bildirim.",
  hold: "Sonunda her cevabına geri bildirim.",
}

export function Simulasyon() {
  return (
    <AbsoluteFill className={s.page} style={{ background: "var(--background)" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={INTRO + TRANSITION}>
          <Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={FILM + TRANSITION}>
          <Film />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={OUTRO}>
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  )
}

function Intro() {
  const logo = useEnter(0)
  const head = useEnter(8)
  const sub = useEnter(26)
  return (
    <AbsoluteFill className="bg-gradient-to-b from-brand-blue/10 via-background to-background px-8">
      <div className="flex h-full flex-col justify-center pb-[120px]">
        <div style={{ opacity: logo, transform: `scale(${0.8 + 0.2 * logo})`, transformOrigin: "left center" }}>
          <UyarlaLogo className="h-9 w-auto text-foreground" />
        </div>
        <p className="mt-8 mb-0 text-[48px] leading-[1.05] font-extrabold tracking-tight text-foreground" style={rise(head)}>
          Mülakattan önce
          <br />
          {INTERVIEWER_NAME} ile prova.
        </p>
        <p className="mt-5 mb-0 text-[22px] leading-snug font-medium text-muted-foreground" style={rise(sub, 16)}>
          İlanına ve CV&apos;ne göre görüşme.
        </p>
      </div>
    </AbsoluteFill>
  )
}

function Film() {
  const frame = useCurrentFrame()
  const label = useEnter(TRANSITION / 2)
  const title = useEnter(TRANSITION / 2 + 4)
  const mock = useEnter(TRANSITION / 2 + 8)
  // Film geçişten sonra başlıyor, son karesinde duruyor; döngüye dönmüyor.
  const ms = Math.min(Math.max(0, ((frame - TRANSITION) * 1000) / FPS), loopMs(SIMULATION_PHASES) - 1)
  return (
    <AbsoluteFill className="bg-gradient-to-b from-brand-blue/10 via-background to-background">
      <div className="flex h-full flex-col px-6 pt-[72px]">
        <UyarlaLogo className="h-6 w-auto self-start text-foreground" />
        <p className="mt-7 mb-0 text-base font-bold tracking-wide text-brand-blue" style={rise(label, 12)}>
          05 · Hazırlan
        </p>
        <p className="mt-1.5 mb-6 text-[32px] leading-[1.12] font-extrabold tracking-tight text-foreground" style={rise(title)}>
          Mülakat simülasyonu
        </p>
        <div className={`${s.mock} ${s.mockWide}`} style={{ opacity: mock, transform: `translateY(${(1 - mock) * 32}px) scale(${0.97 + 0.03 * mock})` }}>
          <SimulationFilm ms={ms} />
        </div>
        <Caption ms={ms} />
      </div>
    </AbsoluteFill>
  )
}

/**
 * O anın satırı ve ne zamandır ekranda olduğu (ms). Ardışık aşamalar aynı
 * satırı paylaşabiliyor; belirme ilk aşamanın başından sayılıyor.
 */
export function captionAt(ms: number): { text: string; sinceMs: number } {
  let t = 0
  let start = 0
  let text = CAPTION[SIMULATION_PHASES[0]!.id]
  for (const p of SIMULATION_PHASES) {
    if (CAPTION[p.id] !== text) {
      text = CAPTION[p.id]
      start = t
    }
    if (ms < t + p.ms) return { text, sinceMs: ms - start }
    t += p.ms
  }
  return { text, sinceMs: ms - start }
}

function Caption({ ms }: { ms: number }) {
  const { text, sinceMs } = captionAt(ms)
  const p = Math.min(1, sinceMs / 300)
  return (
    <p className="mt-6 mb-0 text-center text-[22px] leading-snug font-semibold text-foreground" style={rise(p, 10)}>
      {text}
    </p>
  )
}

function Outro() {
  const logo = useEnter(TRANSITION / 2)
  const head = useEnter(TRANSITION / 2 + 6)
  const url = useEnter(TRANSITION / 2 + 14)
  const note = useEnter(TRANSITION / 2 + 24)
  return (
    <AbsoluteFill className="bg-brand-blue text-white">
      <div className="flex h-full flex-col items-center justify-center gap-5 px-10 pb-[120px] text-center">
        <div style={{ opacity: logo, transform: `scale(${0.8 + 0.2 * logo})` }}>
          <UyarlaLogo className="h-10 w-auto" />
        </div>
        <p className="m-0 text-[42px] leading-[1.08] font-extrabold tracking-tight" style={rise(head)}>
          Görüşmeden önce prova et
        </p>
        <p className="m-0 rounded-full bg-white px-6 py-2.5 text-2xl font-bold text-brand-blue" style={rise(url, 16)}>
          uyarla.com.tr
        </p>
        <p className="m-0 text-base text-white/80" style={rise(note, 12)}>
          Deneyimini uydurmadan
        </p>
      </div>
    </AbsoluteFill>
  )
}
