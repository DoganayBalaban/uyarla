"use client"

import { AnimatePresence, motion, useAnimationFrame, useInView, useReducedMotion } from "motion/react"
import { Check, Download, FileText, Link2, Loader2, MousePointer2, Pause, Play, ShieldCheck, Sparkles } from "lucide-react"
import { useRef, useState } from "react"
import { UyarlaLogo } from "@/components/brand/UyarlaMark"
import {
  DEMO_BASE_SCORE,
  DEMO_BULLETS,
  HERO_FILE_NAME,
  HERO_JOB_TEXT,
  HERO_LOOP_MS,
  HERO_MISSING,
  HERO_PHASES,
  HERO_STAGES,
  demoScore,
  ease,
  heroPhaseAt,
  span,
  typedSlice,
  type Decision,
  type HeroPhaseId,
} from "@/features/landing/demos/demoScript"
import { BulletText, DemoRing } from "@/features/landing/demos/parts"
import s from "@/features/landing/landing.module.css"

/**
 * Hero filmi: CV yükle → ilanı yapıştır → analiz → skor → uyarla, döngü.
 * Video dosyası değil; ürün ekranlarının kopyası, Motion ile oynuyor. Böylece
 * metinler güncel kalıyor, her ekranda keskin ve sayfaya yük bindirmiyor.
 *
 * Her kare `ms`'ten türetiliyor (HeroFilm saf). Saat yalnız film ekrandayken
 * yürüyor; hareket azaltmayı seçen kullanıcı son kareyi durağan görüyor.
 */

const HOLD_MS = phaseStart("hold")
const FINAL_SCORE = demoScore(Object.fromEntries(DEMO_BULLETS.filter((b) => !b.flag).map((b) => [b.id, "new"])))
const HERO_BULLETS = DEMO_BULLETS.filter((b) => !b.flag)

const CHAPTERS: { id: HeroPhaseId; label: string }[] = [
  { id: "upload", label: "CV'ni yükle" },
  { id: "job", label: "İlanı yapıştır" },
  { id: "analyze", label: "Analiz" },
  { id: "score", label: "Skor" },
  { id: "adapt", label: "Uyarla" },
]

function phaseStart(id: HeroPhaseId): number {
  let t = 0
  for (const p of HERO_PHASES) {
    if (p.id === id) return t
    t += p.ms
  }
  return 0
}

export function HeroDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.25 })
  const reduced = useReducedMotion()
  const [ms, setMs] = useState(0)
  const [paused, setPaused] = useState(false)

  useAnimationFrame((_, delta) => {
    if (!inView || paused || reduced) return
    // Sekme arka plandan dönünce gelen büyük sıçramayı kırp.
    setMs((m) => (m + Math.min(delta, 64)) % HERO_LOOP_MS)
  })

  const shownMs = reduced ? HOLD_MS : ms
  const { phase } = heroPhaseAt(shownMs)
  const chapter = phase === "hold" ? "adapt" : phase

  return (
    <div ref={ref}>
      <figure className={`${s.heroFrame} ${s.heroFilmFrame}`}>
        <div className={s.heroFrameBar} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div
          role="img"
          aria-label="uyarla'nın akışı: CV yükleniyor, ilan yapıştırılıyor, skor 28 çıkıyor, uyarlamadan sonra 41'e yükseliyor; değişen maddenin eski hâli üstü çizili, yeni hâli vurgulu."
        >
          <HeroFilm ms={shownMs} />
        </div>
      </figure>

      <div className={s.heroFilmControls}>
        {!reduced && (
          <button
            type="button"
            className={s.heroFilmPause}
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Tanıtımı oynat" : "Tanıtımı duraklat"}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        )}
        <ol className={s.heroChapters}>
          {CHAPTERS.map((c) => {
            const active = c.id === chapter
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  className={`${s.heroChapter} ${active ? s.heroChapterActive : ""}`}
                  onClick={() => {
                    setMs(phaseStart(c.id))
                    setPaused(false)
                  }}
                >
                  {active && <motion.span layoutId="hero-chapter" className={s.heroChapterPill} />}
                  <span className={s.heroChapterText}>{c.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

/** Filmin `ms` anındaki karesi. Saf: aynı `ms` aynı kareyi çizer. */
export function HeroFilm({ ms }: { ms: number }) {
  const { phase, progress } = heroPhaseAt(ms)
  // Uyarla ve bekleme aynı sahne; bekleme sahnenin son hâlinde duruyor.
  const scene = phase === "hold" ? "adapt" : phase
  const p = phase === "hold" ? 1 : progress

  return (
    <div className="relative flex aspect-[4/5] flex-col bg-background text-left text-[13px] text-foreground sm:aspect-[16/10] sm:text-sm lg:text-[15px]">
      <AppBar />
      <div className="relative flex-1 overflow-hidden p-4 sm:p-7">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={scene}
            className="h-full"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {scene === "upload" && <UploadScene p={p} />}
            {scene === "job" && <JobScene p={p} />}
            {scene === "analyze" && <AnalyzeScene p={p} />}
            {scene === "score" && <ScoreScene p={p} />}
            {scene === "adapt" && <AdaptScene p={p} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function AppBar() {
  return (
    <div className="flex items-center gap-5 border-b border-border bg-card px-4 py-2.5 sm:px-6" aria-hidden="true">
      <UyarlaLogo className="h-4 w-auto sm:h-5" />
      <div className="hidden gap-4 text-xs text-muted sm:flex">
        <span>Genel bakış</span>
        <span className="font-semibold text-foreground">Yeni analiz</span>
        <span>Başvuru panosu</span>
      </div>
      <span className="ml-auto flex size-6 items-center justify-center rounded-full bg-brand-blue text-[11px] font-bold text-white">
        E
      </span>
    </div>
  )
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 ${className}`}>{children}</div>
}

function Cursor({ x, y, pressed = false }: { x: string; y: string; pressed?: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute z-10 text-foreground drop-shadow"
      style={{ left: x, top: y }}
      animate={{ scale: pressed ? 0.8 : 1 }}
      transition={{ duration: 0.12 }}
      aria-hidden="true"
    >
      <MousePointer2 size={20} fill="white" strokeWidth={1.6} />
    </motion.div>
  )
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/* ——— Sahneler ——— */

function UploadScene({ p }: { p: number }) {
  const fly = ease(span(p, 0.05, 0.45))
  const bar = span(p, 0.5, 0.95)
  const dropped = fly >= 1
  return (
    <div className="relative mx-auto flex h-full max-w-xl flex-col lg:max-w-2xl justify-center">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Adım 1</p>
      <h3 className="mb-4 text-lg font-extrabold sm:text-xl lg:text-3xl">CV'ni yükle</h3>
      <div
        className={`relative flex min-h-36 flex-col lg:min-h-60 items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 transition-colors ${
          fly > 0.6 ? "border-brand-blue bg-brand-blue-soft" : "border-border bg-card"
        }`}
      >
        {!dropped && <p className="text-muted">PDF veya DOCX'i buraya bırak</p>}
        <motion.div
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-md"
          style={{
            x: lerp(140, 0, fly),
            y: lerp(-110, 0, fly),
            rotate: lerp(8, 0, fly),
            position: dropped ? "relative" : "absolute",
          }}
        >
          <span className="rounded-md bg-brand-red/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-red">PDF</span>
          <span className="font-semibold">{HERO_FILE_NAME}</span>
          {bar >= 1 && <Check size={16} className="text-brand-green" />}
        </motion.div>
        {dropped && (
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-brand-blue" style={{ width: `${bar * 100}%` }} />
          </div>
        )}
        {!dropped && <Cursor x={`calc(50% + ${lerp(150, 10, fly)}px)`} y={`calc(50% + ${lerp(-95, 15, fly)}px)`} />}
      </div>
    </div>
  )
}

function JobScene({ p }: { p: number }) {
  const typed = typedSlice(HERO_JOB_TEXT, span(p, 0.05, 0.75))
  const toButton = ease(span(p, 0.75, 0.9))
  const pressed = p > 0.92
  return (
    <div className="relative mx-auto flex h-full max-w-xl flex-col lg:max-w-2xl justify-center">
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Adım 2</p>
      <h3 className="mb-3 text-lg font-extrabold sm:text-xl lg:text-3xl">İlanı yapıştır</h3>
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <FileText size={14} /> {HERO_FILE_NAME}
        <Check size={14} className="text-brand-green" />
      </div>
      <Card className="min-h-28 lg:min-h-40 lg:text-base">
        <p className="leading-relaxed">
          {typed}
          <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground" />
        </p>
      </Card>
      <div className="relative mt-4 self-end">
        <motion.span
          className="inline-block rounded-[10px] bg-brand-blue px-4 py-2 font-semibold text-white"
          animate={{ scale: pressed ? 0.95 : 1 }}
        >
          Skorumu gör
        </motion.span>
        {p > 0.72 && <Cursor x={`${lerp(-120, 60, toButton)}%`} y={`${lerp(-160, 45, toButton)}%`} pressed={pressed} />}
      </div>
    </div>
  )
}

function AnalyzeScene({ p }: { p: number }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col lg:max-w-lg justify-center">
      <h3 className="mb-4 text-lg font-extrabold sm:text-xl lg:text-3xl">Analiz ediliyor…</h3>
      <ol className="flex flex-col gap-3">
        {HERO_STAGES.map((stage, i) => {
          const done = p > (i + 1) / (HERO_STAGES.length + 0.4)
          const active = !done && p > i / (HERO_STAGES.length + 0.4)
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                className={`flex size-6 items-center justify-center rounded-full ${
                  done ? "bg-brand-green text-white" : active ? "bg-brand-blue-soft text-brand-blue" : "bg-border text-muted"
                }`}
              >
                {done ? <Check size={14} /> : active ? <Loader2 size={14} className="animate-spin" /> : null}
              </span>
              <span className={done || active ? "font-semibold" : "text-muted"}>{stage}</span>
            </li>
          )
        })}
      </ol>
      <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-brand-blue" style={{ width: `${ease(p) * 100}%` }} />
      </div>
    </div>
  )
}

function ScoreScene({ p }: { p: number }) {
  const score = Math.round(DEMO_BASE_SCORE * ease(span(p, 0, 0.4)))
  const toButton = ease(span(p, 0.62, 0.84))
  const pressed = p > 0.88
  return (
    <div className="relative mx-auto flex h-full max-w-xl flex-col lg:max-w-2xl justify-center gap-4">
      <Card className="flex items-center gap-5">
        <DemoRing score={score} size={88} animated={false} />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">ATS uyum skoru</p>
          <p className="text-base font-extrabold sm:text-lg">6 gereksinimden 3'ü karşılanıyor</p>
          <p className="text-xs text-muted">Skor örtüşmeyi ölçer, işe uygunluğunu değil.</p>
        </div>
      </Card>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Eksik anahtar kelimeler</p>
        <div className="flex flex-wrap gap-2">
          {HERO_MISSING.map((k, i) =>
            p > 0.38 + i * 0.07 ? (
              <motion.span
                key={k}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                className="rounded-full bg-brand-red/10 px-2.5 py-1 text-xs font-semibold text-brand-red"
              >
                {k}
              </motion.span>
            ) : null,
          )}
        </div>
      </div>
      <div className="relative self-start">
        <motion.span
          className="inline-flex items-center gap-2 rounded-[10px] bg-brand-blue px-4 py-2 font-semibold text-white"
          animate={{ scale: pressed ? 0.95 : 1 }}
        >
          <Sparkles size={16} /> Tek tıkla uyarla
        </motion.span>
        {p > 0.6 && <Cursor x={`${lerp(220, 70, toButton)}%`} y={`${lerp(-180, 45, toButton)}%`} pressed={pressed} />}
      </div>
    </div>
  )
}

function AdaptScene({ p }: { p: number }) {
  const rise = ease(span(p, 0.4, 0.75))
  const score = Math.round(lerp(DEMO_BASE_SCORE, FINAL_SCORE, rise))
  // Her madde önce eski hâliyle, sonra farkıyla (çıkan üstü çizili, eklenen
  // yeşil) görünür; en sonda yeni hâli seçilir. İkinci madde biraz geriden gelir.
  const stage = (offset: number): Decision | undefined =>
    p < 0.1 + offset ? "old" : p < 0.6 + offset ? undefined : "new"
  const decisions = HERO_BULLETS.map((_, i) => stage(i * 0.12))
  const decided = decisions.filter((d) => d === "new").length
  const ready = decided === HERO_BULLETS.length
  const toDownload = ease(span(p, 0.86, 0.96))
  return (
    <div className="flex h-full flex-col gap-3 sm:gap-4">
      <Card className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Uyarlama</p>
          <p className="text-lg font-extrabold sm:text-2xl">CV'n hazır</p>
          <p className="hidden text-xs text-muted sm:block">
            Her değişikliği aşağıda görebilir, istemediğini eski hâline döndürebilirsin.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <DemoRing score={DEMO_BASE_SCORE} size={52} animated={false} muted label="Önce" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-muted">→</span>
            <motion.span
              className="rounded-full bg-brand-green/15 px-1.5 text-[11px] font-bold text-brand-green"
              animate={{ opacity: rise > 0 ? 1 : 0 }}
            >
              +{score - DEMO_BASE_SCORE}
            </motion.span>
          </div>
          <DemoRing score={score} size={72} animated={false} label="Sonra" />
        </div>
      </Card>
      <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-[1fr_13rem] sm:gap-4 lg:grid-cols-[1fr_15rem]">
        <Card className="min-h-0 overflow-hidden">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-extrabold">Deneyim maddeleri</span>
            <span className="text-xs text-muted">
              {decided}/{HERO_BULLETS.length} karar verildi
            </span>
          </div>
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full rounded-full bg-brand-blue"
              animate={{ width: `${(decided / HERO_BULLETS.length) * 100}%` }}
            />
          </div>
          <div className="flex flex-col gap-3">
            {HERO_BULLETS.map((b, i) => (
              <div key={b.id} className={`rounded-xl border border-border p-3 ${i > 0 ? "hidden sm:block" : ""}`}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">{b.label}</span>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold transition-colors ${
                      decisions[i] === "new" ? "bg-brand-blue-soft text-brand-blue" : "bg-background text-muted"
                    }`}
                  >
                    {decisions[i] === "new" ? "✓ Yeni hâli" : "Karar bekliyor"}
                  </span>
                </div>
                <BulletText segments={b.segments} decision={decisions[i]} />
                <AnimatePresence>
                  {p > 0.3 + i * 0.12 && (
                    <motion.ul
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex flex-col gap-0.5 text-xs text-muted"
                    >
                      {b.evidence.map((e) => (
                        <li key={e.term} className="flex gap-1.5">
                          <Link2 size={12} className="mt-0.5 shrink-0" />
                          <span>
                            <b className="text-foreground">{e.term}</b>, senin “{e.quote}” ifadene dayanıyor.
                          </span>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </Card>
        <div className="hidden flex-col gap-3 sm:flex">
          <Card>
            <p className="mb-1 flex items-center gap-2 font-extrabold">
              <Download size={16} className="text-brand-blue" /> İndir
            </p>
            <p className="mb-3 text-xs text-muted">Seçtiğin hâllerle CV'ni indirebilirsin.</p>
            <div className="relative">
              <motion.span
                className={`flex items-center justify-center gap-2 rounded-[10px] py-2 font-semibold transition-colors ${
                  ready ? "bg-brand-blue text-white" : "bg-border text-muted"
                }`}
                animate={{ scale: p > 0.97 ? 0.96 : 1 }}
              >
                <FileText size={15} /> PDF indir
              </motion.span>
              {p > 0.84 && <Cursor x={`${lerp(-40, 60, toDownload)}%`} y={`${lerp(260, 40, toDownload)}%`} pressed={p > 0.97} />}
            </div>
            <span className="mt-2 flex items-center justify-center rounded-[10px] border border-border py-2 font-semibold">
              Word indir
            </span>
          </Card>
          <p className="flex gap-2 px-1 text-[11px] leading-snug text-muted">
            <ShieldCheck size={14} className="mt-px shrink-0 text-brand-green" />
            Hiçbir deneyim, beceri veya sertifika eklenmedi.
          </p>
        </div>
      </div>
    </div>
  )
}
