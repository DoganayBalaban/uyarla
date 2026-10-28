"use client"

import { UyarlaLogo } from "@/components/brand/UyarlaMark"
import { SCENE_LIST } from "@/features/landing/demos/sceneList"
import { END_MS, reelFrame, reelSegment, type Reel } from "@/features/landing/reels/reels"
import s from "@/features/landing/landing.module.css"

/** Dikey videonun boyu (CSS piksel); kayıt 2 kat çözünürlükle 1080×1920. */
export const REEL_WIDTH = 540
export const REEL_HEIGHT = 960

/** Seslendirmeden gelen süreler: kapanış kartına kadar (`body`) ve kart (`end`), ms. */
export type ReelTiming = { body: number; end: number }

export function reelLength(reel: Reel, timing?: ReelTiming): number {
  if (timing) return timing.body + timing.end
  const scene = SCENE_LIST.find((x) => x.id === reel.scene)!
  return reelSegment(scene.phases, reel.from, reel.to).length + END_MS
}

/**
 * Dikey videonun `ms` anındaki karesi (DOG-162). Saf: aynı an aynı kare.
 * TikTok'un üst (~%7) ve alt (~%20) arayüzü bu alanların üstüne biniyor;
 * logo ve açılış cümlesi üstte, sahne ortada, alt bant boş.
 */
export function ReelFrame({ reel, ms, timing }: { reel: Reel; ms: number; timing?: ReelTiming }) {
  const scene = SCENE_LIST.find((x) => x.id === reel.scene)!
  const frame = reelFrame(reelSegment(scene.phases, reel.from, reel.to), ms, timing?.body)
  return (
    <div className={s.page} style={{ width: REEL_WIDTH, height: REEL_HEIGHT, overflow: "hidden", position: "relative" }}>
      <div className="flex h-full flex-col bg-gradient-to-b from-brand-blue/10 via-background to-background px-6 pt-[72px]">
        <UyarlaLogo className="h-6 w-auto self-start text-foreground" />
        <p className="mt-5 mb-6 text-[30px] leading-[1.15] font-extrabold tracking-tight text-foreground">{reel.hook}</p>
        <div className={`${s.mock} ${s.mockWide}`}>
          <scene.Film ms={frame.sceneMs} />
        </div>
      </div>
      {frame.part === "end" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-brand-blue px-10 text-center text-white">
          <UyarlaLogo className="h-9 w-auto" />
          <p className="m-0 text-[40px] leading-[1.1] font-extrabold tracking-tight">Skorunu ücretsiz gör</p>
          <p className="m-0 text-2xl font-semibold opacity-90">uyarla.com.tr</p>
          <p className="m-0 text-base opacity-80">Kayıt gerekmez · Deneyimini uydurmadan</p>
        </div>
      )}
    </div>
  )
}
