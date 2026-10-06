# DOG-53 · Onboarding 2/4: Onboarding Ekranı ve Giriş Kapısı · Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kayıtlı kullanıcı girişten sonra ve (henüz yapmadıysa) uygulamaya ilk girişinde üç adımlı onboarding'i görsün; bitirince ya da atlayınca gitmek istediği yere dönsün.

**Architecture:** Kapının kararı saf bir fonksiyonda (`features/onboarding/gate.ts`); `/onboarding` sunucu sayfası ve `(app)` layout bu kararı uygular. Giriş dönüşü (`callbackURL`) her zaman `/onboarding?donus=<hedef>`; onboarding'i bitirmiş kullanıcı sunucuda anında hedefe yönleniyor. Ekran istemci bileşeni; her adım DOG-52'nin `PATCH /api/profile` ve `POST /api/resumes` uçlarını çağırıyor.

**Tech Stack:** Next.js 15 (App Router, server components, `redirect`), react-hook-form + zod (DOG-41 düzeni), axios (`@/lib/api`), vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-onboarding-cv-kutuphanesi-design.md` (§3, §6)

## Global Constraints

- Kod isimleri İngilizce; yorumlar ve kullanıcı metinleri Türkçe, marka rehberi §6 tonunda.
- URL parametresi `?donus=` Türkçe kalır (kod kuralları; PR 70'te bozulup düzeltildi). Dönüş adresi her zaman `safeReturnPath`'ten geçer.
- Anonim kullanıcı onboarding'i hiç görmez; kayıtlı ve `onboardedAt` boş kullanıcı bir kez görür.
- Her adımda "Şimdilik geç"; ağ hatasında da kullanıcı hedefe gider (spec §6), onboarding sonraki açılışta yeniden çıkar.
- Arayüz geçici (ileride yenilenecek): mevcut Tailwind tokenları, cila yok.
- `git add`'e yalnızca açık dosya yolları.

## Review Focus

1. **Onboarding'i bitirmiş kullanıcı girişte döngüye girmemeli.** `/onboarding` onu sunucuda hedefe yollar; `(app)` layout'u da yönlendirme bileşeni çizmez. Task 1'de kapı testleri, Task 4'te HTTP ile.
2. **`donus` dış adres ya da `/onboarding`'in kendisi olursa** varsayılana (`/analyze`) düşmeli; aksi hâlde açık yönlendirme ya da döngü. Task 1'de test.
3. **`?uyarla=` ile gelen kullanıcı onboarding'den sonra uyarlamaya dönmeli** (sorgu dizgisi korunmalı). Task 1'de `onboardingPath` ve kapı testi.
4. **"Şimdilik geç" ağ hatasında da yönlendirmeli.** Task 3'te kod incelemesiyle; tarayıcı testi yok.
5. **Oturum süresi dolmuş kullanıcı `/onboarding`'e gelirse** girişe, dönüşte yine onboarding'e gitmeli. Task 1'de kapı testi.

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/src/features/onboarding/gate.ts` | `needsOnboarding`, `onboardingPath`, `onboardingGate` (saf) |
| `apps/web/src/features/onboarding/goals.ts` | Amaç seçeneklerinin Türkçe etiketleri |
| `apps/web/src/features/onboarding/api.ts` | `saveProfile`, `uploadLibraryResume` (axios) |
| `apps/web/src/features/onboarding/components/OnboardingFlow.tsx` | Üç adımlı istemci ekranı |
| `apps/web/src/features/onboarding/components/OnboardingRedirect.tsx` | Girişli kullanıcıyı bir kez onboarding'e yollayan istemci bileşeni |
| `apps/web/src/app/(auth)/onboarding/page.tsx` | Sunucu kapısı |
| `apps/web/src/app/(app)/layout.tsx` | `(app)` sayfalarında onboarding gerekiyorsa yönlendirme bileşeni |
| `apps/web/src/features/auth/components/LoginForm.tsx`, `SocialLogin.tsx` | `callbackURL` → `onboardingPath(returnTo)` |
| `apps/web/src/components/layout/Navbar.tsx` | `/onboarding`'de gizli |

---

### Task 1: Kapı mantığı (saf, testli)

**Files:**
- Create: `apps/web/src/features/onboarding/gate.ts`, `apps/web/src/features/onboarding/gate.test.ts`

**Interfaces:**
- Consumes: `safeReturnPath`, `loginPath` (`@/lib/returnPath`)
- Produces:
  - `needsOnboarding(user: { isAnonymous: boolean; onboardedAt: Date | null } | null): boolean`
  - `onboardingPath(returnTo: string): string` → `/onboarding?donus=<encoded safe path>`
  - `type GateDecision = { kind: "login"; to: string } | { kind: "skip"; to: string } | { kind: "show"; returnTo: string }`
  - `onboardingGate(input: { session: { isAnonymous: boolean } | null; onboardedAt: Date | null; donus: string | undefined }): GateDecision`

- [ ] **Step 1: Başarısız test.** `gate.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { needsOnboarding, onboardingGate, onboardingPath } from "@/features/onboarding/gate"

describe("needsOnboarding", () => {
  it("is true only for a registered user who has not finished", () => {
    expect(needsOnboarding({ isAnonymous: false, onboardedAt: null })).toBe(true)
    expect(needsOnboarding({ isAnonymous: false, onboardedAt: new Date() })).toBe(false)
    expect(needsOnboarding({ isAnonymous: true, onboardedAt: null })).toBe(false)
    expect(needsOnboarding(null)).toBe(false)
  })
})

describe("onboardingPath", () => {
  it("keeps the query string of the target", () => {
    expect(onboardingPath("/analyze?uyarla=abc")).toBe("/onboarding?donus=%2Fanalyze%3Fuyarla%3Dabc")
  })

  it("never points back to onboarding or outside the site", () => {
    expect(onboardingPath("/onboarding?donus=/x")).toBe("/onboarding?donus=%2Fanalyze")
    expect(onboardingPath("https://kotu.site")).toBe("/onboarding?donus=%2Fanalyze")
  })
})

describe("onboardingGate", () => {
  it("sends a visitor without a session to login, coming back to onboarding", () => {
    expect(onboardingGate({ session: null, onboardedAt: null, donus: "/dashboard" })).toEqual({
      kind: "login",
      to: "/login?donus=%2Fonboarding%3Fdonus%3D%252Fdashboard",
    })
  })

  it("skips straight to the target for anonymous and finished users", () => {
    expect(onboardingGate({ session: { isAnonymous: true }, onboardedAt: null, donus: "/analyze?uyarla=1" })).toEqual({
      kind: "skip",
      to: "/analyze?uyarla=1",
    })
    expect(
      onboardingGate({ session: { isAnonymous: false }, onboardedAt: new Date(), donus: "/dashboard" }),
    ).toEqual({ kind: "skip", to: "/dashboard" })
  })

  it("shows onboarding with a safe target", () => {
    expect(onboardingGate({ session: { isAnonymous: false }, onboardedAt: null, donus: "https://kotu.site" })).toEqual({
      kind: "show",
      returnTo: "/analyze",
    })
  })
})
```

- [ ] **Step 2: Başarısız olduğunu gör.** Run: `cd apps/web && pnpm exec vitest run src/features/onboarding/gate.test.ts` → Expected: FAIL (modül yok).

- [ ] **Step 3: Uygula.** `gate.ts`:

```ts
import { DEFAULT_RETURN_PATH, loginPath, safeReturnPath } from "@/lib/returnPath"

/**
 * Onboarding kapısı (DOG-50, spec §3). Karar burada, saf ve testli;
 * `/onboarding` sayfası ve `(app)` layout'u yalnızca uyguluyor.
 */

export function needsOnboarding(user: { isAnonymous: boolean; onboardedAt: Date | null } | null): boolean {
  return !!user && !user.isAnonymous && user.onboardedAt === null
}

/** Onboarding'e geri dönmek döngü yaratır; dış adres açık yönlendirme. */
function safeTarget(raw: string | undefined): string {
  const target = safeReturnPath(raw)
  return target === "/onboarding" || target.startsWith("/onboarding?") ? DEFAULT_RETURN_PATH : target
}

export function onboardingPath(returnTo: string): string {
  return `/onboarding?donus=${encodeURIComponent(safeTarget(returnTo))}`
}

export type GateDecision =
  | { kind: "login"; to: string }
  | { kind: "skip"; to: string }
  | { kind: "show"; returnTo: string }

export function onboardingGate(input: {
  session: { isAnonymous: boolean } | null
  onboardedAt: Date | null
  donus: string | undefined
}): GateDecision {
  const target = safeTarget(input.donus)
  if (!input.session) return { kind: "login", to: loginPath(onboardingPath(target)) }
  if (!needsOnboarding({ isAnonymous: input.session.isAnonymous, onboardedAt: input.onboardedAt })) {
    return { kind: "skip", to: target }
  }
  return { kind: "show", returnTo: target }
}
```

- [ ] **Step 4: Geçtiğini gör.** Aynı komut → Expected: PASS.
- [ ] **Step 5: Commit.** `git add apps/web/src/features/onboarding/gate.ts apps/web/src/features/onboarding/gate.test.ts && git commit -m "Onboarding kapısı mantığı (DOG-53)"`

---

### Task 2: `/onboarding` sayfası, giriş dönüşü ve navbar

**Files:**
- Create: `apps/web/src/app/(auth)/onboarding/page.tsx`
- Create: `apps/web/src/features/onboarding/goals.ts`, `apps/web/src/features/onboarding/api.ts`
- Modify: `apps/web/src/features/auth/components/LoginForm.tsx` (`sendLink` içindeki `callbackURL`), `apps/web/src/features/auth/components/SocialLogin.tsx` (`login` içindeki `callbackURL`), `apps/web/src/components/layout/Navbar.tsx` (gizleme koşulu)

**Interfaces:**
- Consumes: `onboardingGate`, `onboardingPath` (Task 1); `getSession` (`@/server/authz`); `getProfile` (`@/server/profile`, DOG-52)
- Produces:
  - `GOAL_OPTIONS: { value: Goal; label: string; hint: string }[]`
  - `saveProfile(patch: ProfilePatchInput): Promise<void>`, `uploadLibraryResume(file: File, label: string): Promise<void>`; `ProfilePatchInput = z.input<typeof profilePatchSchema>`
  - `/onboarding` sayfası `OnboardingFlow`'u `{ initialName: string; returnTo: string }` ile çiziyor (Task 3 bileşeni üretiyor; bu task'ta sayfa, Task 3 bitene kadar derlenmesin diye Task 3 ile birlikte commit'leniyor).

- [ ] **Step 1: Amaçlar ve API.** `goals.ts`:

```ts
import type { Goal } from "@/features/onboarding/schema"

/** Onboarding ve hesabım sayfasındaki amaç seçenekleri. */
export const GOAL_OPTIONS: { value: Goal; label: string; hint: string }[] = [
  { value: "first_job", label: "İlk işimi arıyorum", hint: "Yeni mezun ya da staj sonrası" },
  { value: "career_change", label: "İş değiştiriyorum", hint: "Başka bir alana ya da şirkete geçiş" },
  { value: "promotion", label: "Bir üst pozisyon istiyorum", hint: "Aynı alanda daha kıdemli bir rol" },
  { value: "exploring", label: "Seçenekleri değerlendiriyorum", hint: "Acelem yok, bakınıyorum" },
]
```

`api.ts`:

```ts
import type { z } from "zod"
import { api } from "@/lib/api"
import type { profilePatchSchema } from "@/features/onboarding/schema"

export type ProfilePatchInput = z.input<typeof profilePatchSchema>

export async function saveProfile(patch: ProfilePatchInput): Promise<void> {
  await api.patch("/profile", patch)
}

/** Kütüphaneye ekler; ilk CV olduğu için varsayılan oluyor (sunucu kuralı). */
export async function uploadLibraryResume(file: File, label: string): Promise<void> {
  const body = new FormData()
  body.append("cv", file)
  if (label.trim()) body.append("label", label)
  await api.post("/resumes", body)
}
```

- [ ] **Step 2: Giriş dönüşü.** `LoginForm.tsx` `sendLink` içinde `callbackURL: returnTo,` → `callbackURL: onboardingPath(returnTo),`; `SocialLogin.tsx` `login` içinde aynısı. İkisine `import { onboardingPath } from "@/features/onboarding/gate"` ekle. `errorCallbackURL` değişmiyor. Yorum ekle (LoginForm'daki mevcut yorumun altına): `// Önce onboarding kapısı: bitirmiş kullanıcıyı sunucu anında hedefe yolluyor.`

- [ ] **Step 3: Navbar.** `Navbar.tsx`'te `if (path.startsWith("/login")) return null` → `if (path.startsWith("/login") || path.startsWith("/onboarding")) return null`.

- [ ] **Step 4: Sayfa.** `app/(auth)/onboarding/page.tsx`:

```tsx
import { redirect } from "next/navigation"
import { prisma } from "@uyarla/db"
import { OnboardingFlow } from "@/features/onboarding/components/OnboardingFlow"
import { onboardingGate } from "@/features/onboarding/gate"
import { getSession } from "@/server/authz"
import { getProfile } from "@/server/profile"

export const dynamic = "force-dynamic"
export const metadata = { title: "Hesabını kur · uyarla" }

/**
 * Onboarding kapısı (spec §3). Giriş dönüşü her zaman buradan geçiyor;
 * bitirmiş ya da anonim kullanıcı ekranı hiç görmeden hedefe gidiyor.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ donus?: string | string[] }>
}) {
  const { donus } = await searchParams
  const session = await getSession()
  const profile = session && !session.user.isAnonymous ? await getProfile(prisma, session.user.id) : null
  const decision = onboardingGate({
    session: session ? { isAnonymous: session.user.isAnonymous } : null,
    onboardedAt: profile?.onboardedAt ?? null,
    donus: Array.isArray(donus) ? donus[0] : donus,
  })
  if (decision.kind !== "show") redirect(decision.to)
  return <OnboardingFlow initialName={profile?.name ?? ""} returnTo={decision.returnTo} />
}
```

(Commit Task 3 ile birlikte; bileşen orada yazılıyor.)

---

### Task 3: Onboarding ekranı (`OnboardingFlow`)

**Files:**
- Create: `apps/web/src/features/onboarding/components/OnboardingFlow.tsx`

**Interfaces:**
- Consumes: `nameSchema`, `profilePatchSchema` alanları (`@/features/onboarding/schema`); `labelSchema` (`@/features/resumes/schema`); dosya için `resumeFileSchema` (`@/features/analysis/schema`); `GOAL_OPTIONS`, `saveProfile`, `uploadLibraryResume` (Task 2); `ResumeUpload` (`@/features/analysis/components/ResumeUpload`); `apiErrorMessage`, `apiStatus` (`@/lib/api`)
- Produces: `OnboardingFlow({ initialName, returnTo })`

- [ ] **Step 1: Bileşeni yaz.**

```tsx
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
  const resumeForm = useForm<ResumeStep>({ resolver: zodResolver(resumeStepSchema), defaultValues: { label: "" } })

  /** Onboarding'i kapatıp hedefe gider. Kayıt düşse de gidiyor (spec §6). */
  async function finish() {
    setBusy(true)
    try {
      await saveProfile({ completeOnboarding: true })
    } catch {
      // Bir sonraki açılışta onboarding yeniden çıkar; kullanıcı burada bekletilmiyor.
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
```

- [ ] **Step 2: Typecheck.** Run: `cd apps/web && pnpm typecheck` → Expected: hatasız. (`apiErrorMessage` imzası `(error, fallback) => Promise<string>` — `@/lib/api`'de doğrula; farklıysa ledger'a ruling.)
- [ ] **Step 3: Commit (Task 2 + 3).**

```bash
git add apps/web/src/features/onboarding/goals.ts apps/web/src/features/onboarding/api.ts apps/web/src/features/onboarding/components/OnboardingFlow.tsx "apps/web/src/app/(auth)/onboarding/page.tsx" apps/web/src/features/auth/components/LoginForm.tsx apps/web/src/features/auth/components/SocialLogin.tsx apps/web/src/components/layout/Navbar.tsx
git commit -m "Onboarding ekranı ve giriş dönüşü kapısı (DOG-53)"
```

---

### Task 4: `(app)` layout yönlendirmesi ve HTTP doğrulaması

**Files:**
- Create: `apps/web/src/features/onboarding/components/OnboardingRedirect.tsx`
- Create: `apps/web/src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `needsOnboarding`, `onboardingPath` (Task 1); `getSession`; `getProfile`
- Produces: `OnboardingRedirect()` (props yok)

- [ ] **Step 1: Bileşen ve layout.** `OnboardingRedirect.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { onboardingPath } from "@/features/onboarding/gate"

/**
 * Oturumu zaten açık olup onboarding'i görmemiş kullanıcıyı (DOG-50 öncesi
 * hesaplar) bir kez onboarding'e yollar; dönüş adresi bulunduğu sayfa.
 * Adres window'dan okunuyor: useSearchParams Suspense sınırı istiyor.
 */
export function OnboardingRedirect() {
  const router = useRouter()
  const sent = useRef(false)
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    router.replace(onboardingPath(window.location.pathname + window.location.search))
  }, [router])
  return null
}
```

`app/(app)/layout.tsx`:

```tsx
import { prisma } from "@uyarla/db"
import { OnboardingRedirect } from "@/features/onboarding/components/OnboardingRedirect"
import { needsOnboarding } from "@/features/onboarding/gate"
import { getSession } from "@/server/authz"
import { getProfile } from "@/server/profile"

/**
 * Uygulama ekranlarının ortak kabı: onboarding'i görmemiş kayıtlı kullanıcı
 * bir kez yönlendiriliyor (spec §3). Anonim kullanıcı için sorgu atılmıyor.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const profile = session && !session.user.isAnonymous ? await getProfile(prisma, session.user.id) : null
  const redirectToOnboarding =
    !!session && needsOnboarding({ isAnonymous: session.user.isAnonymous, onboardedAt: profile?.onboardedAt ?? null })
  return (
    <>
      {redirectToOnboarding && <OnboardingRedirect />}
      {children}
    </>
  )
}
```

- [ ] **Step 2: Typecheck ve birim testleri.** Run: `cd apps/web && pnpm typecheck && pnpm test` → Expected: hatasız, PASS.

- [ ] **Step 3: HTTP doğrulaması** (dev sunucusu açık; DOG-52'deki gibi veritabanında oluşturulmuş imzalı oturum çereziyle — `packages/db` dizininden çalışan oturum betiği):

```bash
B=http://localhost:3000
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$B/onboarding?donus=%2Fdashboard"                 # oturumsuz
curl -s -o /dev/null -w "%{http_code}\n" -H "cookie: $C" "$B/onboarding?donus=%2Fanalyze%3Fuyarla%3Dabc"  # yeni kayıtlı
curl -s -H "cookie: $C" "$B/dashboard" | grep -c "OnboardingRedirect" # layout yönlendirme bileşeni RSC yükünde mi
curl -s -X PATCH $B/api/profile -H "cookie: $C" -H 'content-type: application/json' -d '{"completeOnboarding":true}'
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "cookie: $C" "$B/onboarding?donus=%2Fanalyze%3Fuyarla%3Dabc"  # bitirmiş
```

Expected sırasıyla: `307 …/login?donus=%2Fonboarding%3Fdonus%3D%252Fdashboard`; `200`; ≥1; `{"profile":…onboardedAt…}`; `307 …/analyze?uyarla=abc`. Anonim çerezle `/onboarding` → `307` hedefe. Test kullanıcılarını `DELETE /api/account` ile sil.

- [ ] **Step 4: Commit.** `git add apps/web/src/features/onboarding/components/OnboardingRedirect.tsx "apps/web/src/app/(app)/layout.tsx" && git commit -m "Girişli kullanıcı onboarding'e bir kez yönleniyor (DOG-53)"`

### Task 5: PR ve Linear

- [ ] **Step 1:** `pnpm -r typecheck && (cd apps/web && pnpm test && pnpm build)` → hepsi geçmeli.
- [ ] **Step 2:** PR aç ("Onboarding 2/4: ekran ve giriş kapısı (DOG-53)"); açıklamaya HTTP sonuçları ve "tarayıcıda tıklayarak denenmedi (Chrome yok): adımlar arası geçiş, Şimdilik geç, CV yükleme elle denenmeli" notu.
- [ ] **Step 3:** Vercel kontrolü SUCCESS olmadan merge etme (bkz. bellek: merge öncesi kontroller). DOG-53'ü In Review yap, PR bağlantısı ekle.
