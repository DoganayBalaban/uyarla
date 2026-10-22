"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { LoaderCircle } from "lucide-react"
import { Logo } from "@/components/layout/Logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ResumeUpload } from "@/features/analysis/components/ResumeUpload"
import { resumeFileSchema } from "@/features/analysis/schema"
import { saveProfile, uploadLibraryResume } from "@/features/onboarding/api"
import { ONBOARDING_DEFERRED_COOKIE } from "@/features/onboarding/gate"
import { GOAL_OPTIONS } from "@/features/onboarding/goals"
import { GOALS, nameSchema, TARGET_ROLE_MAX_LENGTH } from "@/features/onboarding/schema"
import { labelSchema } from "@/features/resumes/schema"
import { apiErrorMessage, apiStatus } from "@/lib/api"

/**
 * Üç adımlı onboarding (spec §3): ad → amaç ve hedef rol → CV. Her "İleri"
 * o adımı kaydediyor; "Şimdilik geç" o ana kadar girileni bırakıp
 * onboarding'i tamamlandı işaretliyor ve kullanıcıyı hedefine yolluyor.
 */

const nameStepSchema = z.object({ name: nameSchema })
const goalStepSchema = z.object({
  goal: z.enum(GOALS).nullable(),
  targetRole: z
    .string()
    .trim()
    .max(TARGET_ROLE_MAX_LENGTH, `Hedef rol en fazla ${TARGET_ROLE_MAX_LENGTH} karakter olabilir.`),
})
const resumeStepSchema = z.object({ cv: resumeFileSchema.optional(), label: labelSchema })

type NameStep = z.input<typeof nameStepSchema>
type GoalStep = z.input<typeof goalStepSchema>
type ResumeStep = z.input<typeof resumeStepSchema>
type ResumeStepOutput = z.output<typeof resumeStepSchema>

export function OnboardingFlow({ initialName, returnTo }: { initialName: string; returnTo: string }) {
  const router = useRouter()
  const reducedMotion = useReducedMotion() ?? false
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameForm = useForm<NameStep>({ resolver: zodResolver(nameStepSchema), defaultValues: { name: initialName } })
  const goalForm = useForm<GoalStep>({
    resolver: zodResolver(goalStepSchema),
    defaultValues: { goal: null, targetRole: "" },
  })
  const resumeForm = useForm<ResumeStep, unknown, ResumeStepOutput>({ resolver: zodResolver(resumeStepSchema), defaultValues: { label: "" } })

  /** Onboarding'i kapatıp hedefe gider. Kayıt düşse de gidiyor (spec §6). */
  async function finish() {
    setBusy(true)
    try {
      await saveProfile({ completeOnboarding: true })
    } catch {
      // Kayıt düştü: bu oturumda bir daha yönlendirilmesin (layout çereze
      // bakıyor), bir sonraki açılışta onboarding yeniden çıkar (spec §6).
      document.cookie = `${ONBOARDING_DEFERRED_COOKIE}=1; path=/; SameSite=Lax`
    }
    router.replace(returnTo)
  }

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(
        apiStatus(err) === null
          ? "Sunucuya ulaşamadık. Bağlantını kontrol edip tekrar dener misin?"
          : await apiErrorMessage(err, "Kaydedemedik. Tekrar dener misin?"),
      )
    } finally {
      setBusy(false)
    }
  }

  const submitName = nameForm.handleSubmit((values) =>
    run(async () => {
      await saveProfile({ name: values.name })
      setStep(2)
    }),
  )

  const submitGoal = goalForm.handleSubmit((values) =>
    run(async () => {
      await saveProfile({ goal: values.goal, targetRole: values.targetRole })
      setStep(3)
    }),
  )

  const submitResume = resumeForm.handleSubmit((values) =>
    run(async () => {
      if (values.cv) await uploadLibraryResume(values.cv as File, values.label ?? "")
      await finish()
    }),
  )

  const selectedGoal = goalForm.watch("goal")
  const resumeFile = resumeForm.watch("cv") as File | undefined

  // Adımlar arasında yatay kayma (DOG-155); hareket azaltmada yalnızca geçiş.
  const slide = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
      }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-6">
        <Logo />
      </div>
      <Card className="w-full max-w-lg overflow-hidden py-0 shadow-sm">
        <div className="border-b px-6 pt-5 pb-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Hesabını kur</span>
            <span className="tabular-nums">{step} / 3</span>
          </div>
          <Progress value={(step / 3) * 100} aria-label={`Adım ${step} / 3`} className="mt-2 h-1.5" />
        </div>
        <CardContent className="p-6">
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 && (
              <motion.form key="ad" {...slide} onSubmit={submitName} noValidate>
                <h1 className="m-0 text-2xl font-semibold tracking-tight">Sana nasıl hitap edelim?</h1>
                <p className="m-0 mt-1.5 text-sm text-muted-foreground">Önce seni biraz tanıyalım.</p>
                <div className="mt-6 space-y-1.5">
                  <Label htmlFor="name">Adın</Label>
                  <Input id="name" autoFocus autoComplete="given-name" {...nameForm.register("name")} className="h-11" />
                  {nameForm.formState.errors.name && (
                    <p role="alert" className="m-0 text-sm text-brand-amber">
                      {nameForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <StepActions busy={busy} onSkip={() => void finish()} />
              </motion.form>
            )}

            {step === 2 && (
              <motion.form key="amac" {...slide} onSubmit={submitGoal} noValidate>
                <h1 className="m-0 text-2xl font-semibold tracking-tight">Ne arıyorsun?</h1>
                <p className="m-0 mt-1.5 text-sm text-muted-foreground">İsteğe bağlı. Sonra Hesabım'dan değiştirebilirsin.</p>
                <RadioGroup
                  value={selectedGoal ?? ""}
                  onValueChange={(v) => goalForm.setValue("goal", v as GoalStep["goal"])}
                  aria-label="Amacın"
                  className="mt-6 grid gap-2.5 sm:grid-cols-2"
                >
                  {GOAL_OPTIONS.map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={`amac-${option.value}`}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 font-normal transition-colors hover:bg-muted/50 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5"
                    >
                      <RadioGroupItem id={`amac-${option.value}`} value={option.value} className="mt-0.5" />
                      <span>
                        <span className="block font-medium">{option.label}</span>
                        <span className="block text-sm text-muted-foreground">{option.hint}</span>
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
                <div className="mt-6 space-y-1.5">
                  <Label htmlFor="targetRole">Hedef rolün</Label>
                  <Input id="targetRole" placeholder="Örneğin: Frontend geliştirici" {...goalForm.register("targetRole")} className="h-11" />
                  {goalForm.formState.errors.targetRole && (
                    <p role="alert" className="m-0 text-sm text-brand-amber">
                      {goalForm.formState.errors.targetRole.message}
                    </p>
                  )}
                </div>
                <StepActions busy={busy} onSkip={() => void finish()} />
              </motion.form>
            )}

            {step === 3 && (
              <motion.form key="cv" {...slide} onSubmit={submitResume} noValidate>
                <h1 className="m-0 text-2xl font-semibold tracking-tight">CV&apos;ni bir kez yükle</h1>
                <p className="m-0 mt-1.5 text-sm text-muted-foreground">
                  Her ilanda yeniden yüklemek yerine kayıtlı CV&apos;ni seçersin. İsteğe bağlı.
                </p>
                <div className="mt-6">
                  <ResumeUpload
                    value={resumeFile ?? null}
                    error={resumeForm.formState.errors.cv?.message}
                    onChange={(file) => {
                      resumeForm.setValue("cv", (file ?? undefined) as File | undefined, { shouldValidate: file !== null })
                      if (!file) resumeForm.clearErrors("cv")
                    }}
                  />
                </div>
                {resumeFile && (
                  <div className="mt-4 space-y-1.5">
                    <Label htmlFor="label">CV&apos;nin adı (isteğe bağlı)</Label>
                    <Input id="label" placeholder="Örneğin: Frontend CV" {...resumeForm.register("label")} />
                  </div>
                )}
                <StepActions
                  busy={busy}
                  nextLabel={resumeFile ? "Kaydet ve bitir" : "Bitir"}
                  skipLabel="Sonra eklerim"
                  onSkip={() => void finish()}
                />
              </motion.form>
            )}
          </AnimatePresence>

          {error && (
            <p role="alert" className="m-0 mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

function StepActions({
  busy,
  onSkip,
  nextLabel = "İleri",
  skipLabel = "Şimdilik geç",
}: {
  busy: boolean
  onSkip: () => void
  nextLabel?: string
  skipLabel?: string
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-4">
      <Button type="button" variant="ghost" onClick={onSkip} disabled={busy} className="text-muted-foreground">
        {skipLabel}
      </Button>
      <Button type="submit" disabled={busy}>
        {busy && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
        {nextLabel}
      </Button>
    </div>
  )
}
