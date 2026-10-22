"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowLeft, ArrowRight, Lightbulb, Lock, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { GUIDE_QUESTIONS, recommendStart, type GuideAnswers, type GuideStep } from "@/features/guide/recommend"
import { useSession } from "@/lib/authClient"
import { loginPath } from "@/lib/returnPath"

type Partial4 = Partial<GuideAnswers>

/**
 * "Nereden başlamalıyım?" (DOG-101): her ekranda tek soru, seçince bir
 * sonrakine geçiyor. Sonuç tek bir ilk adım ve en çok iki yan adım.
 * Cevaplar hiçbir yere gönderilmiyor.
 */
export function StartGuide() {
  const reducedMotion = useReducedMotion() ?? false
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Partial4>({})

  // Kayıt isteyen adımlar anonimde girişe gidiyor; oturum ilk çizimden sonra.
  const { data } = useSession()
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const registered = hydrated && !!data?.user && !(data.user as { isAnonymous?: boolean | null }).isAnonymous

  const total = GUIDE_QUESTIONS.length
  const done = step >= total
  const question = GUIDE_QUESTIONS[Math.min(step, total - 1)]!
  const result = done ? recommendStart(answers as GuideAnswers) : null

  function choose(raw: string) {
    const option = question.options.find((o) => String(o.value) === raw)
    if (!option) return
    setAnswers((a) => ({ ...a, [question.key]: option.value }))
    setStep((s) => s + 1)
  }

  const slide = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
        transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
      }

  const hrefFor = (s: GuideStep) => (s.registered && !registered ? loginPath(s.href) : s.href)

  return (
    <Card className="mx-auto w-full max-w-xl overflow-hidden py-0 shadow-xs">
      <div className="border-b px-6 pt-5 pb-4">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>{done ? "Önerin hazır" : "Dört kısa soru"}</span>
          <span className="tabular-nums">{done ? `${total} / ${total}` : `${step + 1} / ${total}`}</span>
        </div>
        <Progress
          value={((done ? total : step) / total) * 100}
          aria-label={done ? "Tamamlandı" : `Soru ${step + 1} / ${total}`}
          className="mt-2 h-1.5"
        />
      </div>
      <CardContent className="p-6">
        <AnimatePresence mode="wait" initial={false}>
          {!done ? (
            <motion.div key={question.key} {...slide}>
              <h2 className="m-0 text-xl font-semibold tracking-tight">{question.title}</h2>
              <RadioGroup
                value={answers[question.key] === undefined ? "" : String(answers[question.key])}
                onValueChange={choose}
                aria-label={question.title}
                className="mt-5 grid gap-2.5"
              >
                {question.options.map((option) => {
                  const id = `${question.key}-${String(option.value)}`
                  return (
                    <Label
                      key={id}
                      htmlFor={id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 font-normal transition-colors hover:bg-muted/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                    >
                      <RadioGroupItem id={id} value={String(option.value)} className="mt-0.5" />
                      <span>
                        <span className="block font-medium">{option.label}</span>
                        {option.hint && <span className="block text-sm text-muted-foreground">{option.hint}</span>}
                      </span>
                    </Label>
                  )
                })}
              </RadioGroup>
              {step > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)} className="mt-4 -ml-2 text-muted-foreground">
                  <ArrowLeft aria-hidden /> Geri
                </Button>
              )}
            </motion.div>
          ) : (
            result && (
              <motion.div key="sonuc" {...slide} aria-live="polite">
                <p className="m-0 text-xs font-semibold tracking-wide text-primary uppercase">İlk adımın</p>
                <h2 className="m-0 mt-1 text-xl font-semibold tracking-tight">{result.primary.title}</h2>
                <p className="m-0 mt-2 text-sm leading-relaxed text-muted-foreground">{result.primary.why}</p>
                <Button asChild className="group mt-4">
                  <Link href={hrefFor(result.primary)}>
                    {result.primary.cta}
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </Button>
                {result.primary.registered && !registered && (
                  <p className="m-0 mt-2 text-xs text-muted-foreground">Ücretsiz hesap gerekiyor; e-postanla bir dakikada açılır.</p>
                )}

                {result.note && (
                  <div className="mt-5 flex gap-3 rounded-lg border bg-muted/40 p-3.5 text-sm">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-amber" aria-hidden />
                    <p className="m-0 text-muted-foreground">{result.note}</p>
                  </div>
                )}

                {result.next.length > 0 && (
                  <>
                    <p className="m-0 mt-6 text-sm font-semibold">Sonra</p>
                    <ul className="m-0 mt-2 grid list-none gap-2 p-0">
                      {result.next.map((s) => (
                        <li key={s.id}>
                          <Link
                            href={hrefFor(s)}
                            className="flex items-start gap-3 rounded-lg border p-3.5 transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5 font-medium">
                                {s.title}
                                {s.registered && !registered && <Lock className="size-3.5 text-muted-foreground" aria-label="Kayıt gerekiyor" />}
                              </span>
                              <span className="block text-sm text-muted-foreground">{s.why}</span>
                            </span>
                            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAnswers({})
                    setStep(0)
                  }}
                  className="mt-5 -ml-2 text-muted-foreground"
                >
                  <RotateCcw aria-hidden /> Baştan başla
                </Button>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
