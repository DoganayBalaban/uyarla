import { fade } from "@remotion/transitions/fade"
import { slide } from "@remotion/transitions/slide"
import { linearTiming, TransitionSeries } from "@remotion/transitions"
import { Fragment } from "react"
import { AbsoluteFill, Audio, Easing, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { UyarlaLogo } from "@/components/brand/UyarlaMark"
import { SCENE_LIST } from "@/features/landing/demos/sceneList"
import { JOURNEY } from "@/features/landing/journey"
import { reelFrame, reelSegment } from "@/features/landing/reels/reels"
import s from "@/features/landing/landing.module.css"
import { FPS, TIMED, TRANSITION, type TimedSegment } from "./timing"

/**
 * "uyarla nedir" tanıtım videosu (DOG-164), 9:16. Sahneler tanıtım
 * sayfasındaki filmlerin kendisi: kare numarası → ms → aynı kare.
 * TikTok'un üst (~%7) ve alt (~%20) arayüzü için o bantlar boş.
 */

const STEPS = TIMED.filter((seg) => seg.kind === "step")
const timing = linearTiming({ durationInFrames: TRANSITION, easing: Easing.inOut(Easing.cubic) })

export function Tanitim() {
  return (
    <AbsoluteFill className={s.page} style={{ background: "var(--background)" }}>
      <TransitionSeries>
        {TIMED.map((seg, i) => (
          <Fragment key={seg.id}>
            {i > 0 && (
              <TransitionSeries.Transition
                presentation={seg.kind === "step" && TIMED[i - 1]!.kind === "step" ? slide({ direction: "from-right" }) : fade()}
                timing={timing}
              />
            )}
            <TransitionSeries.Sequence durationInFrames={seg.duration}>
              {seg.kind === "intro" && <Intro />}
              {seg.kind === "step" && <Step seg={seg} />}
              {seg.kind === "outro" && <Outro />}
              <Sequence from={seg.voiceFrom}>
                <Audio src={staticFile(`tanitim/${seg.id}.wav`)} />
              </Sequence>
            </TransitionSeries.Sequence>
          </Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  )
}

/** `delay` karesinden sonra 0→1 yaylı giriş. */
function useEnter(delay: number): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping: 200 } })
}

const rise = (p: number, px = 24) => ({ opacity: p, transform: `translateY(${(1 - p) * px}px)` })

function Intro() {
  const logo = useEnter(0)
  const head = useEnter(8)
  const sub = useEnter(48)
  return (
    <AbsoluteFill className="bg-gradient-to-b from-brand-blue/10 via-background to-background px-8">
      <div className="flex h-full flex-col justify-center pb-[120px]">
        <div style={{ opacity: logo, transform: `scale(${0.8 + 0.2 * logo})`, transformOrigin: "left center" }}>
          <UyarlaLogo className="h-9 w-auto text-foreground" />
        </div>
        <p className="mt-8 mb-0 text-[52px] leading-[1.05] font-extrabold tracking-tight text-foreground" style={rise(head)}>
          Her ilana,
          <br />
          doğru CV.
        </p>
        <p className="mt-5 mb-0 text-[22px] leading-snug font-medium text-muted-foreground" style={rise(sub, 16)}>
          Başvurunun her adımında yanında.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          {JOURNEY.map((step, i) => (
            <Chip key={step.id} delay={60 + i * 6}>
              {step.name}
            </Chip>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  )
}

function Chip({ delay, children }: { delay: number; children: React.ReactNode }) {
  const p = useEnter(delay)
  return (
    <span className="rounded-full border border-brand-blue/25 bg-card px-3.5 py-1.5 text-base font-semibold text-brand-blue" style={rise(p, 12)}>
      {children}
    </span>
  )
}

function Step({ seg }: { seg: TimedSegment }) {
  const frame = useCurrentFrame()
  const label = useEnter(TRANSITION / 2)
  const title = useEnter(TRANSITION / 2 + 4)
  const mock = useEnter(TRANSITION / 2 + 8)
  const scene = SCENE_LIST.find((x) => x.id === seg.scene)!
  // Sahne bölümün görünen süresine yayılıyor; çıkış geçişinde son karede duruyor.
  const body = ((seg.duration - TRANSITION) * 1000) / FPS
  const { sceneMs } = reelFrame(reelSegment(scene.phases, seg.from, seg.to), (frame * 1000) / FPS, body)
  const index = STEPS.findIndex((x) => x.id === seg.id)
  return (
    <AbsoluteFill className="bg-gradient-to-b from-brand-blue/10 via-background to-background">
      <div className="flex h-full flex-col px-6 pt-[72px]">
        <div className="flex items-center justify-between">
          <UyarlaLogo className="h-6 w-auto text-foreground" />
          <Progress index={index} />
        </div>
        <p className="mt-7 mb-0 text-base font-bold tracking-wide text-brand-blue" style={rise(label, 12)}>
          {seg.label}
        </p>
        <p className="mt-1.5 mb-6 text-[32px] leading-[1.12] font-extrabold tracking-tight text-foreground" style={rise(title)}>
          {seg.title}
        </p>
        <div className={`${s.mock} ${s.mockWide}`} style={{ opacity: mock, transform: `translateY(${(1 - mock) * 32}px) scale(${0.97 + 0.03 * mock})` }}>
          <scene.Film ms={sceneMs} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

/** Kaçıncı adımda olunduğu: geçilenler dolu, sıradaki uzun. */
function Progress({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {STEPS.map((x, i) => (
        <span
          key={x.id}
          className={i <= index ? "bg-brand-blue" : "bg-foreground/15"}
          style={{ height: 6, width: i === index ? 22 : 6, borderRadius: 3 }}
        />
      ))}
    </div>
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
        <p className="m-0 text-[44px] leading-[1.08] font-extrabold tracking-tight" style={rise(head)}>
          Skorunu ücretsiz gör
        </p>
        <p className="m-0 rounded-full bg-white px-6 py-2.5 text-2xl font-bold text-brand-blue" style={rise(url, 16)}>
          uyarla.com.tr
        </p>
        <p className="m-0 text-base text-white/80" style={rise(note, 12)}>
          Kayıt gerekmez · Deneyimini uydurmadan
        </p>
      </div>
    </AbsoluteFill>
  )
}
