"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { LoaderCircle } from "lucide-react"
import { ResumeUpload } from "@/features/analysis/components/ResumeUpload"
import { resumeFileSchema } from "@/features/analysis/schema"
import { saveProfile, uploadLibraryResume } from "@/features/onboarding/api"
import { ONBOARDING_DEFERRED_COOKIE } from "@/features/onboarding/gate"
import { GOAL_OPTIONS } from "@/features/onboarding/goals"
import { GOALS, nameSchema, TARGET_ROLE_MAX_LENGTH } from "@/features/onboarding/schema"
import { labelSchema } from "@/features/resumes/schema"
import { apiErrorMessage, apiStatus } from "@/lib/api"
import { cn } from "@/lib/cn"

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

const inputClass =
  "w-full rounded-button border border-border bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-button bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2442e0] disabled:cursor-not-allowed disabled:opacity-60"
const skipButton = "text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"

export function OnboardingFlow({ initialName, returnTo }: { initialName: string; returnTo: string }) {
  const router = useRouter()
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

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-12">
      <p className="text-sm font-medium text-muted">{step}/3</p>

      {step === 1 && (
        <form onSubmit={submitName} noValidate className="mt-3">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">Sana nasıl hitap edelim?</h1>
          <p className="mt-2 text-muted">Panoda ve menüde bu adı göreceksin.</p>
          <label htmlFor="name" className="mt-8 mb-1.5 block text-sm font-medium">
            Adın
          </label>
          <input id="name" autoFocus autoComplete="given-name" {...nameForm.register("name")} className={inputClass} />
          {nameForm.formState.errors.name && (
            <p role="alert" className="mt-2 text-sm text-brand-amber">
              {nameForm.formState.errors.name.message}
            </p>
          )}
          <StepActions busy={busy} onSkip={() => void finish()} />
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submitGoal} noValidate className="mt-3">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">Ne arıyorsun?</h1>
          <p className="mt-2 text-muted">İsteğe bağlı. Sonra hesabım sayfasından değiştirebilirsin.</p>
          <div role="radiogroup" aria-label="Amacın" className="mt-6 grid gap-2.5 sm:grid-cols-2">
            {GOAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selectedGoal === option.value}
                onClick={() =>
                  goalForm.setValue("goal", selectedGoal === option.value ? null : option.value)
                }
                className={cn(
                  "rounded-card border p-3.5 text-left transition-colors",
                  selectedGoal === option.value
                    ? "border-brand-blue bg-brand-blue/5"
                    : "border-border bg-card hover:border-brand-blue/50",
                )}
              >
                <span className="block font-semibold">{option.label}</span>
                <span className="text-sm text-muted">{option.hint}</span>
              </button>
            ))}
          </div>
          <label htmlFor="targetRole" className="mt-6 mb-1.5 block text-sm font-medium">
            Hedef rolün
          </label>
          <input
            id="targetRole"
            placeholder="Örneğin: Frontend geliştirici"
            {...goalForm.register("targetRole")}
            className={inputClass}
          />
          {goalForm.formState.errors.targetRole && (
            <p role="alert" className="mt-2 text-sm text-brand-amber">
              {goalForm.formState.errors.targetRole.message}
            </p>
          )}
          <StepActions busy={busy} onSkip={() => void finish()} />
        </form>
      )}

      {step === 3 && (
        <form onSubmit={submitResume} noValidate className="mt-3">
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">CV&apos;ni bir kez yükle</h1>
          <p className="mt-2 text-muted">Her ilanda yeniden yüklemek yerine kayıtlı CV&apos;ni seçersin. İsteğe bağlı.</p>
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
            <>
              <label htmlFor="label" className="mt-4 mb-1.5 block text-sm font-medium">
                CV&apos;nin adı (isteğe bağlı)
              </label>
              <input
                id="label"
                placeholder="Örneğin: Frontend CV"
                {...resumeForm.register("label")}
                className={inputClass}
              />
            </>
          )}
          <StepActions
            busy={busy}
            nextLabel={resumeFile ? "Kaydet ve bitir" : "Bitir"}
            skipLabel="Sonra eklerim"
            onSkip={() => void finish()}
          />
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-brand-red">
          {error}
        </p>
      )}
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
      <button type="button" onClick={onSkip} disabled={busy} className={skipButton}>
        {skipLabel}
      </button>
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
        {nextLabel}
      </button>
    </div>
  )
}
