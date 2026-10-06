# DOG-54 · Onboarding 3/4: CV Kütüphanesi Arayüzü · Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kayıtlı kullanıcı CV'sini bir kez yükleyip sonraki ilanlarda kütüphaneden seçerek analiz başlatsın; hesabım sayfasında profilini ve CV'lerini yönetsin.

**Architecture:** Saf yardımcılar (`features/resumes/library.ts`) ve istemci şeması (`analyzeFormSchema`) testli; TanStack Query kancaları `features/resumes/api.ts` ve `features/account/api.ts`'te. Analiz formunda yeni `ResumePicker` bileşeni; hesabım sayfasına iki bölüm (`ProfileSection`, `ResumeLibrarySection`). Sunucuya yalnızca `GET /api/profile` ekleniyor; diğer uçlar DOG-52'de hazır.

**Tech Stack:** Next.js 15, TanStack Query 5, react-hook-form + zod 4, axios, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-onboarding-cv-kutuphanesi-design.md` (§5, §6)

## Global Constraints

- Kod İngilizce, yorum ve kullanıcı metni Türkçe (marka rehberi §6 tonu).
- Veri istekleri `features/<alan>/api.ts`'te; bileşenlerde çıplak `fetch` yok (kod kuralları).
- Kütüphane en fazla 5 CV (`LIBRARY_MAX`); dolunca "CV ekle" devre dışı ve nedenini söylüyor.
- Kütüphane yalnızca kayıtlı kullanıcıda görünür; anonim kullanıcıda analiz formu bugünkü gibi.
- Arayüz geçici: mevcut Tailwind tokenları, cila yok.
- Merge yalnızca Vercel kontrolü SUCCESS iken.
- `git add`'e yalnızca açık yollar.

## Review Focus

1. **Silinmiş ya da başka sekmede kaldırılmış CV seçiliyken gönderim.** 404 → "Bu CV artık kütüphanende değil." ve liste yenilenir, seçim varsayılana döner. Task 4'te kod; HTTP ile 404 zaten DOG-52'de doğrulandı.
2. **Kütüphane doluyken "Kütüphaneme kaydet" işaretli gönderim.** Analiz başlar, `savedToLibrary: false` → kullanıcıya not. Task 4.
3. **Hem kayıtlı CV seçili hem dosya yüklenmiş durum.** Şema tam birini ister; "Yeni dosya yükle"ye geçince `resumeId` temizlenir, karta dönünce dosya temizlenir. Task 3 testi + Task 4.
4. **Varsayılan CV kaldırılınca liste ve analiz formundaki ön seçim.** Sunucu varsayılanı devrediyor; sorgu geçersizlenip yeniden çekiliyor. Task 5.
5. **Anonim oturum hesabım sayfasında** profil/CV bölümlerini görmemeli (uçlar 401 döner). Task 5.

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `apps/web/src/app/api/profile/route.ts` | (değişiyor) `GET` eklendi |
| `apps/web/src/features/resumes/library.ts` (+test) | `resumeTitle`, `initialResumeId`, `isLibraryFull` |
| `apps/web/src/features/resumes/api.ts` | Kütüphane sorgu ve mutasyon kancaları |
| `apps/web/src/features/account/api.ts` | (değişiyor) `useProfile`, `useSaveProfile` |
| `apps/web/src/features/analysis/schema.ts` (+test) | (değişiyor) `analyzeFormSchema` |
| `apps/web/src/features/analysis/components/ResumePicker.tsx` | Kayıtlı CV kartları + "Yeni dosya yükle" |
| `apps/web/src/features/analysis/components/AnalyzeView.tsx` | (değişiyor) seçici, gönderim, hata/not |
| `apps/web/src/features/account/components/ProfileSection.tsx` | Ad, amaç, hedef rol formu |
| `apps/web/src/features/account/components/ResumeLibrarySection.tsx` | CV listesi ve yönetimi |
| `apps/web/src/features/account/components/AccountView.tsx` | (değişiyor) iki bölümü kayıtlı kullanıcıda çiziyor |

---

### Task 1: `GET /api/profile` ve saf kütüphane yardımcıları

**Files:**
- Modify: `apps/web/src/app/api/profile/route.ts`
- Create: `apps/web/src/features/resumes/library.ts`, `apps/web/src/features/resumes/library.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/profile` → `{ profile: { name, email, goal, targetRole, onboardedAt } }` (kayıtlı kullanıcı; anonim 401)
  - `resumeTitle(r: Pick<LibraryResume, "label" | "fileName">): string`
  - `initialResumeId(resumes: LibraryResume[]): string | null`
  - `isLibraryFull(resumes: LibraryResume[]): boolean`

- [ ] **Step 1: Başarısız test.** `library.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { LibraryResume } from "@/features/resumes/schema"
import { initialResumeId, isLibraryFull, resumeTitle } from "@/features/resumes/library"

function resume(id: string, extra: Partial<LibraryResume> = {}): LibraryResume {
  return { id, label: null, fileName: `${id}.pdf`, createdAt: "2026-10-06T00:00:00.000Z", isDefault: false, ...extra }
}

describe("resumeTitle", () => {
  it("prefers the label, then the file name, then a generic title", () => {
    expect(resumeTitle({ label: "Frontend CV", fileName: "a.pdf" })).toBe("Frontend CV")
    expect(resumeTitle({ label: null, fileName: "a.pdf" })).toBe("a.pdf")
    expect(resumeTitle({ label: null, fileName: null })).toBe("Kayıtlı CV")
  })
})

describe("initialResumeId", () => {
  it("picks the default, else the first, else none", () => {
    expect(initialResumeId([resume("a"), resume("b", { isDefault: true })])).toBe("b")
    expect(initialResumeId([resume("a"), resume("b")])).toBe("a")
    expect(initialResumeId([])).toBeNull()
  })
})

describe("isLibraryFull", () => {
  it("is full at five", () => {
    expect(isLibraryFull(["a", "b", "c", "d"].map((id) => resume(id)))).toBe(false)
    expect(isLibraryFull(["a", "b", "c", "d", "e"].map((id) => resume(id)))).toBe(true)
  })
})
```

- [ ] **Step 2:** Run `cd apps/web && pnpm exec vitest run src/features/resumes/library.test.ts` → FAIL (modül yok).

- [ ] **Step 3: Uygula.** `library.ts`:

```ts
import { LIBRARY_MAX, type LibraryResume } from "@/features/resumes/schema"

/** Kütüphane listesinin istemci tarafı kuralları; hesabım ve analiz formu ortak. */

export function resumeTitle(resume: Pick<LibraryResume, "label" | "fileName">): string {
  return resume.label ?? resume.fileName ?? "Kayıtlı CV"
}

/** Analiz formunda ön seçili CV: varsayılan, yoksa listenin ilki. */
export function initialResumeId(resumes: LibraryResume[]): string | null {
  return (resumes.find((r) => r.isDefault) ?? resumes[0])?.id ?? null
}

export function isLibraryFull(resumes: LibraryResume[]): boolean {
  return resumes.length >= LIBRARY_MAX
}
```

`app/api/profile/route.ts`'ye `GET` ekle (importlara `getProfile`):

```ts
/** Hesabım sayfasının profil bölümü için. */
export async function GET() {
  try {
    const { user } = ensureRegistered(await getSession())
    return NextResponse.json({ profile: await getProfile(prisma, user.id) })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/profile]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
```

- [ ] **Step 4:** Testler PASS; `pnpm typecheck` hatasız; `curl -s localhost:3000/api/profile` → `no_session`.
- [ ] **Step 5: Commit.** `git add apps/web/src/features/resumes/library.ts apps/web/src/features/resumes/library.test.ts apps/web/src/app/api/profile/route.ts && git commit -m "Kütüphane yardımcıları ve GET /api/profile (DOG-54)"`

---

### Task 2: Veri kancaları

**Files:**
- Create: `apps/web/src/features/resumes/api.ts`
- Modify: `apps/web/src/features/account/api.ts`

**Interfaces:**
- Consumes: `LibraryResume`, `ResumePatch` tipleri; `ProfilePatchInput` (`@/features/onboarding/api`); `Profile` şekli (sunucu tipi istemciye taşınmıyor; `ProfileView` arayüzü tanımlanıyor)
- Produces:
  - `resumesQueryKey = ["resumes"] as const`
  - `useLibrary(enabled: boolean)` → `useQuery<LibraryResume[]>`
  - `useUploadResume()`, `useUpdateResume()`, `useRemoveResume()` → mutasyonlar; başarıda `resumesQueryKey` geçersizleniyor
  - `interface ProfileView { name: string; email: string; goal: Goal | null; targetRole: string | null }`
  - `useProfile(enabled: boolean)`, `useSaveProfile()`

- [ ] **Step 1: `features/resumes/api.ts`:**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { LibraryResume } from "@/features/resumes/schema"
import type { z } from "zod"
import type { resumePatchSchema } from "@/features/resumes/schema"

export type ResumePatchInput = z.input<typeof resumePatchSchema>

export const resumesQueryKey = ["resumes"] as const

export async function getLibrary(): Promise<LibraryResume[]> {
  return (await api.get<{ resumes: LibraryResume[] }>("/resumes")).data.resumes
}

/** Yalnızca kayıtlı kullanıcıda açılıyor; anonim oturumda uç 401 döner. */
export function useLibrary(enabled: boolean) {
  return useQuery({ queryKey: resumesQueryKey, queryFn: getLibrary, enabled })
}

function useInvalidatingMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: resumesQueryKey }),
  })
}

export function useUploadResume() {
  return useInvalidatingMutation(async ({ file, label }: { file: File; label: string }) => {
    const body = new FormData()
    body.append("cv", file)
    if (label.trim()) body.append("label", label)
    await api.post("/resumes", body)
  })
}

export function useUpdateResume() {
  return useInvalidatingMutation(async ({ id, patch }: { id: string; patch: ResumePatchInput }) => {
    await api.patch(`/resumes/${encodeURIComponent(id)}`, patch)
  })
}

export function useRemoveResume() {
  return useInvalidatingMutation(async (id: string) => {
    await api.delete(`/resumes/${encodeURIComponent(id)}`)
  })
}
```

- [ ] **Step 2: `features/account/api.ts`'ye ekle:**

```ts
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { Goal } from "@/features/onboarding/schema"
import { saveProfile, type ProfilePatchInput } from "@/features/onboarding/api"

export interface ProfileView {
  name: string
  email: string
  goal: Goal | null
  targetRole: string | null
}

export const profileQueryKey = ["profile"] as const

export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: async () => (await api.get<{ profile: ProfileView }>("/profile")).data.profile,
    enabled,
  })
}

export function useSaveProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfilePatchInput) => saveProfile(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey }),
  })
}
```

(Mevcut `useMutation` importunu birleştir.)

- [ ] **Step 3:** `pnpm typecheck` hatasız. Commit: `git add apps/web/src/features/resumes/api.ts apps/web/src/features/account/api.ts && git commit -m "Kütüphane ve profil sorgu kancaları (DOG-54)"`

---

### Task 3: Analiz formunun şeması (`analyzeFormSchema`)

**Files:**
- Modify: `apps/web/src/features/analysis/schema.ts`, `apps/web/src/features/analysis/schema.test.ts`

**Interfaces:**
- Produces: `analyzeFormSchema` (z.object: `resumeId?: string`, `cv?: ResumeFileLike`, `saveToLibrary: boolean`, `jobText: string`, `postingUrl?: string`; superRefine: `resumeId` ile `cv`'den tam biri), `AnalyzeFormValues = z.input<…>`

- [ ] **Step 1: Başarısız test** (`schema.test.ts` sonuna):

```ts
describe("analyzeFormSchema", () => {
  const cv = { name: "cv.pdf", size: 10 }

  it("accepts either a library CV or a new file", () => {
    expect(analyzeFormSchema.safeParse({ resumeId: "r1", jobText: POSTING, saveToLibrary: false }).success).toBe(true)
    expect(analyzeFormSchema.safeParse({ cv, jobText: POSTING, saveToLibrary: true }).success).toBe(true)
  })

  it("asks for a CV when neither is given", () => {
    const parsed = analyzeFormSchema.safeParse({ jobText: POSTING, saveToLibrary: false })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(firstIssue(parsed.error).code).toBe("missing_file")
  })

  it("rejects both at once", () => {
    expect(analyzeFormSchema.safeParse({ resumeId: "r1", cv, jobText: POSTING, saveToLibrary: false }).success).toBe(false)
  })

  it("still validates the file and the job text", () => {
    const parsed = analyzeFormSchema.safeParse({ cv: { name: "cv.txt", size: 10 }, jobText: "kısa", saveToLibrary: false })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(firstIssue(parsed.error).code).toBe("unsupported_format")
  })
})
```

Importa `analyzeFormSchema` ekle.

- [ ] **Step 2:** Run `pnpm exec vitest run src/features/analysis/schema.test.ts` → FAIL.

- [ ] **Step 3: Uygula** (`schema.ts`, `analysisFormSchema`'nın altına):

```ts
/**
 * İstemci analiz formu (DOG-50): kütüphanedeki CV (`resumeId`) ya da yeni
 * dosya (`cv`), tam biri. Sunucu iki yolu ayrı doğruluyor (validateUpload /
 * validateJobText); bu şema formun hangi yolda olduğunu söylüyor.
 */
export const analyzeFormSchema = z
  .object({
    resumeId: z.string().min(1).optional(),
    cv: resumeFileSchema.optional(),
    saveToLibrary: z.boolean(),
    jobText: jobTextSchema,
    postingUrl: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasLibrary = value.resumeId !== undefined
    const hasFile = value.cv !== undefined
    if (hasLibrary === hasFile) {
      ctx.addIssue({
        code: "custom",
        path: ["cv"],
        message: hasLibrary ? "Bir CV seç ya da yeni dosya yükle; ikisi birden olmaz." : "CV'ni seçer misin? PDF ya da DOCX olabilir.",
        params: { code: hasLibrary ? "ambiguous_resume" : "missing_file" },
      })
    }
  })

export type AnalyzeFormValues = z.input<typeof analyzeFormSchema>
```

Not: zod `superRefine` nesne alanları geçerliyse çalışır; dosya biçimi hatası önce raporlanır (dördüncü test bunu sabitliyor). `cv` yoksa `resumeFileSchema.optional()` geçer, eksiklik superRefine'da yakalanır.

- [ ] **Step 4:** Testler PASS. Commit: `git add apps/web/src/features/analysis/schema.ts apps/web/src/features/analysis/schema.test.ts && git commit -m "Analiz formu: kayıtlı CV ya da yeni dosya şeması (DOG-54)"`

---

### Task 4: Analiz formunda CV seçimi

**Files:**
- Create: `apps/web/src/features/analysis/components/ResumePicker.tsx`
- Modify: `apps/web/src/features/analysis/components/AnalyzeView.tsx`

**Interfaces:**
- Consumes: `useLibrary`, `resumesQueryKey` (Task 2); `analyzeFormSchema`, `AnalyzeFormValues` (Task 3); `resumeTitle`, `initialResumeId`, `isLibraryFull` (Task 1); `useSession` (`@/lib/authClient`); `ResumeUpload`
- Produces: `ResumePicker({ resumes, selectedId, onSelect, onUploadNew })` — `selectedId: string | null`; `null` = "Yeni dosya yükle" modu

- [ ] **Step 1: `ResumePicker.tsx`:**

```tsx
"use client"

import { FileText, Star, UploadCloud } from "lucide-react"
import type { LibraryResume } from "@/features/resumes/schema"
import { resumeTitle } from "@/features/resumes/library"
import { cn } from "@/lib/cn"

const DATE = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" })

/**
 * Kayıtlı CV'ler (DOG-50): biri seçili ya da "Yeni dosya yükle". Seçim
 * analiz formunda; bu bileşen yalnızca çiziyor.
 */
export function ResumePicker({
  resumes,
  selectedId,
  onSelect,
  onUploadNew,
}: {
  resumes: LibraryResume[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUploadNew: () => void
}) {
  return (
    <div role="radiogroup" aria-label="Kayıtlı CV'lerin" className="grid gap-2">
      {resumes.map((resume) => (
        <label
          key={resume.id}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-card border p-3 transition-colors",
            selectedId === resume.id ? "border-brand-blue bg-brand-blue/5" : "border-border bg-card hover:border-brand-blue/50",
          )}
        >
          <input
            type="radio"
            name="libraryResume"
            className="sr-only"
            checked={selectedId === resume.id}
            onChange={() => onSelect(resume.id)}
          />
          <FileText className="size-5 shrink-0 text-brand-blue" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{resumeTitle(resume)}</span>
            <span className="text-xs text-muted">{DATE.format(new Date(resume.createdAt))}</span>
          </span>
          {resume.isDefault && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-amber/15 px-2 py-0.5 text-xs font-semibold">
              <Star className="size-3" aria-hidden /> Varsayılan
            </span>
          )}
        </label>
      ))}
      <label
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-card border border-dashed p-3 transition-colors",
          selectedId === null ? "border-brand-blue bg-brand-blue/5" : "border-border hover:border-brand-blue/50",
        )}
      >
        <input type="radio" name="libraryResume" className="sr-only" checked={selectedId === null} onChange={onUploadNew} />
        <UploadCloud className="size-5 shrink-0 text-muted" aria-hidden />
        <span className="font-semibold">Yeni dosya yükle</span>
      </label>
    </div>
  )
}
```

- [ ] **Step 2: `AnalyzeView.tsx` değişiklikleri.**
  - Import: `useSession` (`@/lib/authClient`), `useQueryClient` zaten var; `ResumePicker`; `useLibrary`, `resumesQueryKey` (`@/features/resumes/api`); `initialResumeId`, `isLibraryFull` (`@/features/resumes/library`); `analysisFormSchema` → `analyzeFormSchema`, `AnalysisFormValues` → `AnalyzeFormValues`; `LIBRARY_MAX` (`@/features/resumes/schema`).
  - Form: `useForm<AnalyzeFormValues>({ resolver: zodResolver(analyzeFormSchema), defaultValues: { jobText: "", postingUrl: "", saveToLibrary: false } })`.
  - Oturum ve kütüphane:

```tsx
  const { data: sessionData } = useSession()
  const registered = !!sessionData?.user && !(sessionData.user as { isAnonymous?: boolean | null }).isAnonymous
  const library = useLibrary(registered)
  const resumes = library.data ?? []
  const libraryFull = isLibraryFull(resumes)
  const selectedResumeId = watch("resumeId") ?? null
  const [libraryNote, setLibraryNote] = useState<string | null>(null)

  // Kütüphane gelince varsayılan CV ön seçili; kullanıcı dosya modunu seçtiyse dokunma.
  const [pickedMode, setPickedMode] = useState(false)
  useEffect(() => {
    if (pickedMode || resumes.length === 0) return
    const initial = initialResumeId(resumes)
    if (initial) setValue("resumeId", initial)
  }, [resumes, pickedMode, setValue])
```

  - Gönderim (`onSubmit`) gövdesi:

```tsx
    const body = new FormData()
    if (values.resumeId) {
      body.append("resumeId", values.resumeId)
    } else {
      body.append("cv", values.cv as File)
      if (registered && values.saveToLibrary) body.append("saveToLibrary", "true")
    }
    body.append("jobText", values.jobText)
    setLibraryNote(null)

    try {
      const { jobId, savedToLibrary } = await startAnalysis(body)
      if (savedToLibrary === false) {
        setLibraryNote(`Kütüphanende ${LIBRARY_MAX} CV olduğu için bu dosyayı kaydetmedik; analiz yine başladı.`)
      }
      if (savedToLibrary) void queryClient.invalidateQueries({ queryKey: resumesQueryKey })
      …(mevcut: startActiveAnalysis, setState, setPollJobId)
    } catch (error) {
      // Seçili CV başka sekmede kaldırılmış olabilir (K-35: 404).
      if (values.resumeId && apiStatus(error) === 404) {
        setError("Bu CV artık kütüphanende değil. Listeyi yeniledik; başka bir CV seçebilirsin.")
        setPickedMode(false)
        setValue("resumeId", undefined)
        await queryClient.invalidateQueries({ queryKey: resumesQueryKey })
        setBusy(false)
        return
      }
      …(mevcut hata yolu)
    }
```

  - `startAnalysis`'ın dönüş tipi `{ jobId: string; savedToLibrary?: boolean }` olacak şekilde `features/analysis/api.ts`'de güncellenir.
  - Çizim (1. adım):

```tsx
          {registered && resumes.length > 0 && (
            <ResumePicker
              resumes={resumes}
              selectedId={selectedResumeId}
              onSelect={(id) => {
                setPickedMode(true)
                setValue("resumeId", id, { shouldValidate: !!errors.cv })
                setValue("cv", undefined)
              }}
              onUploadNew={() => {
                setPickedMode(true)
                setValue("resumeId", undefined)
              }}
            />
          )}
          {(!registered || resumes.length === 0 || selectedResumeId === null) && (
            <div className={registered && resumes.length > 0 ? "mt-3" : undefined}>
              <ResumeUpload … (mevcut) />
              {registered && (
                libraryFull ? (
                  <p className="mt-2 text-sm text-muted">Kütüphanende {LIBRARY_MAX} CV var; bu dosya kaydedilmeyecek.</p>
                ) : (
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" {...register("saveToLibrary")} className="size-4 accent-brand-blue" />
                    Kütüphaneme kaydet, sonraki ilanlarda seçeyim
                  </label>
                )
              )}
            </div>
          )}
          {registered && resumes.length > 0 && selectedResumeId !== null && errors.cv && (
            <p role="alert" className="mt-2 text-sm text-brand-amber">{errors.cv.message}</p>
          )}
```

  - `libraryNote` çalışan analiz çizelgesinin üstünde gösterilir (`running` dalında `StageTimeline`'dan önce, `text-sm text-muted` paragraf).

- [ ] **Step 3:** `pnpm typecheck && pnpm test` → hatasız/PASS. Dev sunucusunda `/analyze` 200; kayıtlı test oturumuyla `/api/resumes` dolu iken sayfa sunucuda hata vermiyor.
- [ ] **Step 4: Commit.** `git add apps/web/src/features/analysis/components/ResumePicker.tsx apps/web/src/features/analysis/components/AnalyzeView.tsx apps/web/src/features/analysis/api.ts && git commit -m "Analiz formunda kayıtlı CV seçimi ve kütüphaneye kaydet (DOG-54)"`

---

### Task 5: Hesabım sayfası: Profilin ve CV'lerim

**Files:**
- Create: `apps/web/src/features/account/components/ProfileSection.tsx`, `apps/web/src/features/account/components/ResumeLibrarySection.tsx`
- Modify: `apps/web/src/features/account/components/AccountView.tsx` (iki bölüm, kayıtlı kullanıcıda, hesap kartı ile bağlantı kartları arasına)

**Interfaces:**
- Consumes: `useProfile`, `useSaveProfile`, `ProfileView` (Task 2); `GOAL_OPTIONS` (`@/features/onboarding/goals`); `nameSchema`, `GOALS`, `TARGET_ROLE_MAX_LENGTH`; `useLibrary`, `useUploadResume`, `useUpdateResume`, `useRemoveResume`; `resumeTitle`, `isLibraryFull`; `labelSchema`, `LIBRARY_MAX`; `resumeFileSchema`; `ResumeUpload`; `apiErrorMessage`
- Produces: `ProfileSection()`, `ResumeLibrarySection()` (props yok)

- [ ] **Step 1: `ProfileSection.tsx`:**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { LoaderCircle } from "lucide-react"
import { useProfile, useSaveProfile } from "@/features/account/api"
import { GOAL_OPTIONS } from "@/features/onboarding/goals"
import { GOALS, nameSchema, TARGET_ROLE_MAX_LENGTH } from "@/features/onboarding/schema"
import { apiErrorMessage } from "@/lib/api"

const profileFormSchema = z.object({
  name: nameSchema,
  goal: z.enum(GOALS).or(z.literal("")),
  targetRole: z.string().trim().max(TARGET_ROLE_MAX_LENGTH, `Hedef rol en fazla ${TARGET_ROLE_MAX_LENGTH} karakter olabilir.`),
})
type ProfileForm = z.input<typeof profileFormSchema>

const inputClass =
  "w-full rounded-button border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"

/** Ad, amaç, hedef rol (DOG-50). Onboarding'de atlananlar burada tamamlanıyor. */
export function ProfileSection() {
  const profile = useProfile(true)
  const save = useSaveProfile()
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const { register, handleSubmit, reset, formState } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: "", goal: "", targetRole: "" },
  })

  useEffect(() => {
    if (profile.data) {
      reset({ name: profile.data.name, goal: profile.data.goal ?? "", targetRole: profile.data.targetRole ?? "" })
    }
  }, [profile.data, reset])

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null)
    try {
      await save.mutateAsync({ name: values.name, goal: values.goal || null, targetRole: values.targetRole })
      setMessage({ kind: "ok", text: "Kaydedildi." })
    } catch (error) {
      setMessage({ kind: "error", text: await apiErrorMessage(error, "Kaydedemedik. Tekrar dener misin?") })
    }
  })

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <h2 className="m-0 text-lg">Profilin</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4">
        <div>
          <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium">Adın</label>
          <input id="profile-name" {...register("name")} className={inputClass} />
          {formState.errors.name && <p role="alert" className="mt-1 text-sm text-brand-amber">{formState.errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="profile-goal" className="mb-1.5 block text-sm font-medium">Amacın</label>
          <select id="profile-goal" {...register("goal")} className={inputClass}>
            <option value="">Belirtmek istemiyorum</option>
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="profile-role" className="mb-1.5 block text-sm font-medium">Hedef rolün</label>
          <input id="profile-role" placeholder="Örneğin: Frontend geliştirici" {...register("targetRole")} className={inputClass} />
          {formState.errors.targetRole && <p role="alert" className="mt-1 text-sm text-brand-amber">{formState.errors.targetRole.message}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={save.isPending || profile.isPending} className="inline-flex items-center gap-2 rounded-button bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {save.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
            Kaydet
          </button>
          {message && (
            <p role="status" className={message.kind === "ok" ? "text-sm text-brand-green" : "text-sm text-brand-red"}>{message.text}</p>
          )}
        </div>
      </form>
    </section>
  )
}
```

- [ ] **Step 2: `ResumeLibrarySection.tsx`:**

```tsx
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { FileText, LoaderCircle, Pencil, Star, Trash2 } from "lucide-react"
import { ResumeUpload } from "@/features/analysis/components/ResumeUpload"
import { resumeFileSchema } from "@/features/analysis/schema"
import { useLibrary, useRemoveResume, useUpdateResume, useUploadResume } from "@/features/resumes/api"
import { isLibraryFull, resumeTitle } from "@/features/resumes/library"
import { LIBRARY_MAX, labelSchema, type LibraryResume } from "@/features/resumes/schema"
import { apiErrorMessage } from "@/lib/api"

const addSchema = z.object({ cv: resumeFileSchema, label: labelSchema })
const renameSchema = z.object({ label: labelSchema })

const inputClass =
  "w-full rounded-button border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-blue"
const smallButton = "inline-flex items-center gap-1 rounded-button border border-border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"

/** CV kütüphanesi (DOG-50, spec §5): listele, yeniden adlandır, varsayılan yap, kaldır, ekle. */
export function ResumeLibrarySection() {
  const library = useLibrary(true)
  const resumes = library.data ?? []
  const full = isLibraryFull(resumes)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg">CV&apos;lerim</h2>
        <span className="text-sm text-muted">{resumes.length}/{LIBRARY_MAX}</span>
      </div>
      <p className="m-0 mt-1 text-sm text-muted">Analizde yeniden yüklemek yerine buradan seçersin. Kaldırdığın CV&apos;yle yapılmış analizler panoda kalır.</p>

      {library.isPending ? (
        <LoaderCircle className="mt-4 size-5 motion-safe:animate-spin text-muted" aria-hidden />
      ) : resumes.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Henüz kayıtlı CV&apos;n yok.</p>
      ) : (
        <ul className="mt-4 grid list-none gap-2 p-0">
          {resumes.map((resume) => (
            <ResumeRow key={resume.id} resume={resume} onError={setError} />
          ))}
        </ul>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-brand-red">{error}</p>}

      {adding ? (
        <AddResumeForm onDone={() => setAdding(false)} onError={setError} />
      ) : (
        <div className="mt-4">
          <button type="button" disabled={full} onClick={() => setAdding(true)} className="rounded-button bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            CV ekle
          </button>
          {full && <p className="mt-2 text-sm text-muted">En fazla {LIBRARY_MAX} CV kaydedebilirsin. Yeni eklemek için birini kaldır.</p>}
        </div>
      )}
    </section>
  )
}

function ResumeRow({ resume, onError }: { resume: LibraryResume; onError: (message: string | null) => void }) {
  const update = useUpdateResume()
  const remove = useRemoveResume()
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const form = useForm<z.input<typeof renameSchema>, unknown, z.output<typeof renameSchema>>({
    resolver: zodResolver(renameSchema),
    defaultValues: { label: resume.label ?? "" },
  })

  async function guard(action: () => Promise<unknown>, fallback: string) {
    onError(null)
    try {
      await action()
      return true
    } catch (error) {
      onError(await apiErrorMessage(error, fallback))
      return false
    }
  }

  const rename = form.handleSubmit(async ({ label }) => {
    if (await guard(() => update.mutateAsync({ id: resume.id, patch: { label } }), "Adını değiştiremedik.")) setRenaming(false)
  })

  return (
    <li className="rounded-button border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="size-4 shrink-0 text-brand-blue" aria-hidden />
        {renaming ? (
          <form onSubmit={rename} noValidate className="flex min-w-0 flex-1 gap-2">
            <input aria-label="CV'nin adı" autoFocus {...form.register("label")} className={inputClass} />
            <button type="submit" className={smallButton} disabled={update.isPending}>Kaydet</button>
          </form>
        ) : (
          <span className="min-w-0 flex-1 truncate font-medium">{resumeTitle(resume)}</span>
        )}
        {resume.isDefault ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-amber/15 px-2 py-0.5 text-xs font-semibold">
            <Star className="size-3" aria-hidden /> Varsayılan
          </span>
        ) : (
          <button type="button" className={smallButton} disabled={update.isPending}
            onClick={() => void guard(() => update.mutateAsync({ id: resume.id, patch: { isDefault: true } }), "Varsayılan yapamadık.")}>
            Varsayılan yap
          </button>
        )}
        {!renaming && (
          <button type="button" className={smallButton} onClick={() => setRenaming(true)} aria-label={`${resumeTitle(resume)} adını değiştir`}>
            <Pencil className="size-3" aria-hidden />
          </button>
        )}
        <button type="button" className={smallButton} onClick={() => setConfirming(true)} aria-label={`${resumeTitle(resume)} kaldır`}>
          <Trash2 className="size-3" aria-hidden />
        </button>
      </div>
      {form.formState.errors.label && <p role="alert" className="mt-1 text-sm text-brand-amber">{form.formState.errors.label.message}</p>}
      {confirming && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-button bg-brand-red/5 p-2.5 text-sm">
          <span className="flex-1">Kütüphaneden kaldırılsın mı? Bu CV&apos;yle yapılmış analizler panoda kalır.</span>
          <button type="button" className="rounded-button bg-brand-red px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" disabled={remove.isPending}
            onClick={() => void guard(() => remove.mutateAsync(resume.id), "Kaldıramadık.").then((ok) => ok && setConfirming(false))}>
            Kaldır
          </button>
          <button type="button" className={smallButton} onClick={() => setConfirming(false)}>Vazgeç</button>
        </div>
      )}
    </li>
  )
}

function AddResumeForm({ onDone, onError }: { onDone: () => void; onError: (message: string | null) => void }) {
  const upload = useUploadResume()
  const form = useForm<z.input<typeof addSchema>, unknown, z.output<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: { label: "" },
  })
  const file = form.watch("cv") as File | undefined

  const submit = form.handleSubmit(async ({ cv, label }) => {
    onError(null)
    try {
      await upload.mutateAsync({ file: cv as File, label: label ?? "" })
      onDone()
    } catch (error) {
      onError(await apiErrorMessage(error, "CV'ni kaydedemedik."))
    }
  })

  return (
    <form onSubmit={submit} noValidate className="mt-4 grid gap-3">
      <ResumeUpload
        value={file ?? null}
        error={form.formState.errors.cv?.message}
        onChange={(next) => {
          form.setValue("cv", (next ?? undefined) as File | undefined, { shouldValidate: next !== null })
          if (!next) form.clearErrors("cv")
        }}
      />
      <input aria-label="CV'nin adı (isteğe bağlı)" placeholder="CV'nin adı (isteğe bağlı)" {...form.register("label")} className={inputClass} />
      <div className="flex gap-2">
        <button type="submit" disabled={upload.isPending} className="inline-flex items-center gap-2 rounded-button bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {upload.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
          Kaydet
        </button>
        <button type="button" onClick={onDone} className={smallButton}>Vazgeç</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: `AccountView.tsx`'e ekle** (importlar ve hesap kartından sonra):

```tsx
        {registered && (
          <>
            <ProfileSection />
            <ResumeLibrarySection />
          </>
        )}
```

- [ ] **Step 4:** `pnpm typecheck && pnpm test` PASS; `/account` dev sunucusunda 200 (anonim ve kayıtlı test çereziyle).
- [ ] **Step 5: Commit.** `git add apps/web/src/features/account/components/ProfileSection.tsx apps/web/src/features/account/components/ResumeLibrarySection.tsx apps/web/src/features/account/components/AccountView.tsx && git commit -m "Hesabım: profil ve CV kütüphanesi bölümleri (DOG-54)"`

---

### Task 6: Doğrulama, PR, Linear

- [ ] **Step 1:** `pnpm -r typecheck && (cd apps/web && pnpm test && pnpm build)` (build dev sunucusu durdurulmuşken) → geçmeli.
- [ ] **Step 2: HTTP:** kayıtlı test oturumuyla `GET /api/profile` (profil döner), `/account` ve `/analyze` 200 ve sunucu günlüğünde hata yok; anonim çerezle `/account` 200, `GET /api/profile` 401. Test kullanıcılarını sil.
- [ ] **Step 3:** PR "Onboarding 3/4: CV kütüphanesi arayüzü (DOG-54)"; açıklamada "tarayıcıda tıklayarak denenmedi (Chrome yok)" ve elle denenmesi gerekenler: kart seçimi, yeni dosya + kaydet kutusu, dolu kütüphane notu, silinmiş CV mesajı, hesabımda ekle/yeniden adlandır/varsayılan/kaldır, profil kaydet.
- [ ] **Step 4:** Vercel SUCCESS olmadan merge yok. DOG-54 In Review.
