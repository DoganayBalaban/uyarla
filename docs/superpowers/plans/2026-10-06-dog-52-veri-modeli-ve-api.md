# DOG-52 · Onboarding 1/4: Veri Modeli ve API · Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Profil (ad, amaç, hedef rol, onboarding tamamlandı) ve CV kütüphanesi için veri modelini, sunucu kurallarını ve API uçlarını eklemek. `POST /api/analyze` kayıtlı CV ile ve "kütüphaneme kaydet" seçeneğiyle çalışacak.

**Architecture:**
- **Kurallar saf fonksiyonlarda:** 5 CV sınırı, ilk kaydedilen CV varsayılan olur, varsayılan devri. Bunlar `server/resumeLibrary.ts`'te saf fonksiyonlar olarak duruyor.
- **Veritabanı işlemleri aynı modülde:** `db` parametresi alan async fonksiyonlar. Route'lar ince: şemayla doğrular, modülü çağırır, AuthError/PermanentError'ı HTTP yanıtına çevirir.
- **Şemalar ortak:** `features/<alan>/schema.ts` altında, istemci ve sunucu aynı şemayı kullanıyor (DOG-41 düzeni).

**Tech Stack:** Next.js 15 route handlers, Prisma 5 (Postgres), zod 4, vitest (birim ve tümleşik).

**Spec:** `docs/superpowers/specs/2026-10-06-onboarding-cv-kutuphanesi-design.md` (§2, §4, §6, §7)

## Global Constraints

- **Dil:** Kod isimleri İngilizce; yorumlar ve kullanıcıya görünen metinler Türkçe, marka rehberi §6 tonunda (suçlamayan, sonraki adımı gösteren).
- **Sahiplik:** Sahiplik ihlalinde ve kütüphanede olmayan CV'de 404 döner, 403 değil (K-35). `ensureOwner` kullanılır.
- **Kayıt şartı:** Kütüphane ve profil uçları kayıtlı kullanıcı ister (`ensureRegistered`). Anonim kullanıcının CV'si kütüphaneye girmez.
- **Kütüphane sınırı:** En fazla 5 CV (`LIBRARY_MAX = 5`). Etiket en fazla 60, ad en fazla 60, hedef rol en fazla 80 karakter.
- **Amaçlar:** `career_change`, `first_job`, `promotion`, `exploring`.
- **Kaldırma:** Kütüphaneden kaldırma yalnızca `savedAt` ve `isDefault`'u temizler; `Resume` satırı ve ona bağlı analizler kalır.
- **Varsayılan:** Kullanıcı başına en fazla bir varsayılan CV olur; transaction içinde korunur.
- **Şema dosyaları:** `@uyarla/core`'u içe aktarmaz (istemci paketine girmesin).
- **Git:** `git add`'e dizin verilmez, yalnızca açık dosya yolları (eval/runs dosyaları commit'e sızıyor).

## Review Focus

1. **İki istek aynı anda 5. ve 6. CV'yi kaydeder.** Sınır aşılmamalı: sayım ve yazma aynı transaction'da yapılır. Task 3'te ardışık 6 kayıtla test edilir. Gerçek eşzamanlılık testi yok, bu yüzden incelemede dikkat edilmeli.
2. **Başkasının ya da kütüphaneden kaldırılmış CV'nin `resumeId`'si analize verilir.** 404 dönmeli ve yeni analiz açılmamalı. Task 3'te `findLibraryResume` testleri bunu kapsar.
3. **Varsayılan CV kaldırılır.** En yeni kayıtlı CV varsayılan olmalı; hiç CV kalmadıysa varsayılan da kalmamalı. Task 3'te test edilir.
4. **Anonim kullanıcı `saveToLibrary=true` ya da `resumeId` gönderir.** `saveToLibrary` sessizce yok sayılır ve analiz başlar; `resumeId` ise 401 `registration_required` döner. Task 6'da HTTP ile denenir.
5. **Onboarding iki kez tamamlanır.** `onboardedAt` ilk tarihte kalmalı, üzerine yazılmamalı. Task 4'te test edilir.

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `packages/db/prisma/schema.prisma` | `Goal` enum; User: `onboardedAt`, `goal`, `targetRole`. Resume: `label`, `fileName`, `savedAt`, `isDefault` |
| `packages/db/prisma/migrations/20261006120000_onboarding_cv_kutuphanesi/migration.sql` | Yalnızca ekleme yapan migration |
| `apps/web/src/features/onboarding/schema.ts` | `GOALS`, `nameSchema`, `profilePatchSchema` |
| `apps/web/src/features/resumes/schema.ts` | `LIBRARY_MAX`, `labelSchema`, `resumePatchSchema`, `LibraryResume` tipi |
| `apps/web/src/features/analysis/schema.ts` | (değişiyor) `resumeFileSchema` ve `jobTextSchema` dışa açılıyor |
| `apps/web/src/server/upload.ts` | (değişiyor) `validateResumeFile`, `validateJobText` |
| `apps/web/src/server/resumeLibrary.ts` | Kütüphane kuralları (saf) ve veritabanı işlemleri |
| `apps/web/src/server/profile.ts` | `getProfile`, `updateProfile` |
| `apps/web/src/app/api/profile/route.ts` | `PATCH` |
| `apps/web/src/app/api/resumes/route.ts` | `GET`, `POST` |
| `apps/web/src/app/api/resumes/[id]/route.ts` | `PATCH`, `DELETE` |
| `apps/web/src/app/api/analyze/route.ts` | (değişiyor) `resumeId` ve `saveToLibrary` |

**Spec'ten bir sapma:** Spec "etiket boşsa dosya adı gösterilir" diyor, ama `Resume.filePath` depodaki yol (`resumes/<uuid>.pdf`) ve dosyanın asıl adını tutmuyor. Bu yüzden `Resume.fileName String?` alanı ekleniyor ve spec §2 tablosu Task 1'de güncelleniyor.

---

### Task 1: Veri modeli ve migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (User ve Resume modelleri)
- Create: `packages/db/prisma/migrations/20261006120000_onboarding_cv_kutuphanesi/migration.sql`
- Modify: `docs/superpowers/specs/2026-10-06-onboarding-cv-kutuphanesi-design.md` (§2 Resume tablosu)

**Interfaces:**
- Produces: Prisma tipleri `Goal`, `User.onboardedAt/goal/targetRole`, `Resume.label/fileName/savedAt/isDefault`.

- [ ] **Step 1: Şemayı güncelle.** `User` modeline `jobPostings` satırından sonra şunları ekle:

```prisma
  // Onboarding (DOG-50). Boşsa kayıtlı kullanıcıya onboarding gösterilir;
  // tamamlanınca ya da atlanınca doluyor.
  onboardedAt   DateTime?
  goal          Goal?
  targetRole    String?
```

`Resume` modeline `createdAt` satırından sonra şunları ekle:

```prisma
  // CV kütüphanesi (DOG-50). savedAt doluysa kütüphanede; kaldırma yalnızca
  // bunu temizler, bağlı analizler kalır.
  label     String?
  fileName  String?
  savedAt   DateTime?
  isDefault Boolean   @default(false)
```

`ResumeStatus` enum'undan sonra şunu ekle:

```prisma
enum Goal {
  career_change
  first_job
  promotion
  exploring
}
```

- [ ] **Step 2: Migration'ı üret.**

Run: `cd packages/db && pnpm exec dotenv -e ../../.env -- prisma migrate dev --name onboarding_cv_kutuphanesi --create-only`

Üretilen dizini `20261006120000_onboarding_cv_kutuphanesi` olarak yeniden adlandır (repo elle verilmiş zaman damgası kullanıyor). İçeriği şu olmalı:

```sql
-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('career_change', 'first_job', 'promotion', 'exploring');

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "savedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "goal" "Goal",
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "targetRole" TEXT;
```

- [ ] **Step 3: Yerelde uygula ve doğrula.**

Run: `cd packages/db && pnpm migrate:deploy && pnpm migrate:status && pnpm generate`
Expected: "Database schema is up to date!" Client üretilmiş olmalı.

- [ ] **Step 4: Spec'i düzelt.** §2 `Resume` tablosuna `label` satırından sonra şunu ekle:

```markdown
| `fileName` | `String?` | Yüklenen dosyanın asıl adı; `filePath` depodaki yol olduğu için ayrıca tutuluyor. Etiket boşsa gösterilir. |
```

- [ ] **Step 5: Typecheck ve commit.**

Run: `pnpm -r typecheck`
Expected: hatasız.

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261006120000_onboarding_cv_kutuphanesi/migration.sql docs/superpowers/specs/2026-10-06-onboarding-cv-kutuphanesi-design.md
git commit -m "Profil ve CV kütüphanesi alanları (DOG-52)"
```

---

### Task 2: Ortak şemalar

**Files:**
- Create: `apps/web/src/features/onboarding/schema.ts`, `apps/web/src/features/onboarding/schema.test.ts`
- Create: `apps/web/src/features/resumes/schema.ts`, `apps/web/src/features/resumes/schema.test.ts`
- Modify: `apps/web/src/features/analysis/schema.ts` (`resumeFileSchema` ve `jobTextSchema` başına `export`)
- Modify: `apps/web/src/server/upload.ts`, `apps/web/src/server/upload.test.ts`

**Interfaces:**
- Consumes: `firstIssue` (`@/lib/validation`)
- Produces:
  - `GOALS`, `Goal`, `nameSchema`, `profilePatchSchema`, `ProfilePatch = z.output<typeof profilePatchSchema>`
  - `LIBRARY_MAX = 5`, `labelSchema`, `resumePatchSchema`, `ResumePatch`, `interface LibraryResume { id: string; label: string | null; fileName: string | null; createdAt: string; isDefault: boolean }`
  - `validateResumeFile(file: unknown): void`, `validateJobText(jobText: string): string`

- [ ] **Step 1: Başarısız testleri yaz.** `features/onboarding/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { profilePatchSchema } from "@/features/onboarding/schema"
import { firstIssue } from "@/lib/validation"

function errorOf(body: unknown): string | null {
  const parsed = profilePatchSchema.safeParse(body)
  return parsed.success ? null : firstIssue(parsed.error).message
}

describe("profilePatchSchema", () => {
  it("accepts any subset of fields and trims text", () => {
    expect(profilePatchSchema.parse({ name: "  Doğanay " }).name).toBe("Doğanay")
    expect(profilePatchSchema.parse({ goal: "first_job", targetRole: " Frontend " }).targetRole).toBe("Frontend")
    expect(errorOf({ completeOnboarding: true })).toBeNull()
  })

  it("lets goal and target role be cleared", () => {
    expect(profilePatchSchema.parse({ goal: null, targetRole: null })).toEqual({ goal: null, targetRole: null })
  })

  it("turns an empty target role into null", () => {
    expect(profilePatchSchema.parse({ targetRole: "   " }).targetRole).toBeNull()
  })

  it("rejects an empty name, unknown goal and long values in Turkish", () => {
    expect(errorOf({ name: "  " })).toBe("Adını yazar mısın?")
    expect(errorOf({ name: "x".repeat(61) })).toBe("Ad en fazla 60 karakter olabilir.")
    expect(errorOf({ goal: "rich" })).toBe("Geçersiz amaç.")
    expect(errorOf({ targetRole: "x".repeat(81) })).toBe("Hedef rol en fazla 80 karakter olabilir.")
  })

  it("rejects an empty patch", () => {
    expect(errorOf({})).toBe("Güncellenecek bir şey yok.")
  })
})
```

`features/resumes/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { resumePatchSchema } from "@/features/resumes/schema"
import { firstIssue } from "@/lib/validation"

function errorOf(body: unknown): string | null {
  const parsed = resumePatchSchema.safeParse(body)
  return parsed.success ? null : firstIssue(parsed.error).message
}

describe("resumePatchSchema", () => {
  it("accepts a label, making default, or both", () => {
    expect(resumePatchSchema.parse({ label: " Frontend CV " }).label).toBe("Frontend CV")
    expect(errorOf({ isDefault: true })).toBeNull()
  })

  it("turns an empty label into null so the file name shows", () => {
    expect(resumePatchSchema.parse({ label: "  " }).label).toBeNull()
  })

  it("does not accept isDefault false (default moves by picking another)", () => {
    expect(errorOf({ isDefault: false })).not.toBeNull()
  })

  it("rejects a long label and an empty patch", () => {
    expect(errorOf({ label: "x".repeat(61) })).toBe("CV adı en fazla 60 karakter olabilir.")
    expect(errorOf({})).toBe("Güncellenecek bir şey yok.")
  })
})
```

`server/upload.test.ts`'nin sonuna (son `})` kapanışından önce, `describe("validateUpload")` içine değil ayrı bloklar olarak) ekle:

```ts
describe("validateResumeFile", () => {
  it("checks only the file", () => {
    expect(() => validateResumeFile({ name: "cv.pdf", size: 100 })).not.toThrow()
    try {
      validateResumeFile({ name: "cv.txt", size: 100 })
      expect.unreachable()
    } catch (error) {
      expect((error as PermanentError).code).toBe("unsupported_format")
    }
  })
})

describe("validateJobText", () => {
  it("returns the text or throws the short-text error", () => {
    expect(validateJobText(TEST_POSTING)).toBe(TEST_POSTING)
    expect(() => validateJobText("kısa")).toThrow(PermanentError)
  })
})
```

Aynı dosyada import satırını `import { validateJobText, validateResumeFile, validateUpload } from "./upload.js"` yap.

- [ ] **Step 2: Testlerin başarısız olduğunu gör.**

Run: `cd apps/web && pnpm exec vitest run src/features/onboarding src/features/resumes src/server/upload.test.ts`
Expected: FAIL. Modüller ve fonksiyonlar henüz yok.

- [ ] **Step 3: Şemaları yaz.** `features/onboarding/schema.ts`:

```ts
import { z } from "zod"

/**
 * Profil ve onboarding şemaları. Onboarding ekranı, hesabım sayfası ve
 * `PATCH /api/profile` aynı kurallarla doğruluyor.
 */

export const GOALS = ["career_change", "first_job", "promotion", "exploring"] as const
export type Goal = (typeof GOALS)[number]

export const NAME_MAX_LENGTH = 60
export const TARGET_ROLE_MAX_LENGTH = 80

export const nameSchema = z
  .string({ error: "Adını yazar mısın?" })
  .trim()
  .min(1, "Adını yazar mısın?")
  .max(NAME_MAX_LENGTH, `Ad en fazla ${NAME_MAX_LENGTH} karakter olabilir.`)

/** Boş metin "hedef rol yok" demek; veritabanına null yazılıyor. */
const targetRoleSchema = z
  .string({ error: "Geçersiz hedef rol." })
  .trim()
  .max(TARGET_ROLE_MAX_LENGTH, `Hedef rol en fazla ${TARGET_ROLE_MAX_LENGTH} karakter olabilir.`)
  .transform((value) => value || null)

export const profilePatchSchema = z
  .object({
    name: nameSchema.optional(),
    goal: z.enum(GOALS, { error: "Geçersiz amaç." }).nullable().optional(),
    targetRole: targetRoleSchema.nullable().optional(),
    /** Onboarding bitti ya da atlandı. */
    completeOnboarding: z.literal(true).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    error: "Güncellenecek bir şey yok.",
  })

export type ProfilePatch = z.output<typeof profilePatchSchema>
```

`features/resumes/schema.ts`:

```ts
import { z } from "zod"

/** CV kütüphanesi şemaları; arayüz ve `/api/resumes` uçları ortak kullanıyor. */

export const LIBRARY_MAX = 5
export const LABEL_MAX_LENGTH = 60

/** Boş etiket "dosya adını göster" demek; veritabanına null yazılıyor. */
export const labelSchema = z
  .string({ error: "Geçersiz CV adı." })
  .trim()
  .max(LABEL_MAX_LENGTH, `CV adı en fazla ${LABEL_MAX_LENGTH} karakter olabilir.`)
  .transform((value) => value || null)

export const resumePatchSchema = z
  .object({
    label: labelSchema.nullable().optional(),
    // Yalnızca true: varsayılan, başka bir CV varsayılan yapılınca el değiştiriyor.
    isDefault: z.literal(true, { error: "Geçersiz istek." }).optional(),
  })
  .refine((body) => body.label !== undefined || body.isDefault !== undefined, {
    error: "Güncellenecek bir şey yok.",
  })

export type ResumePatch = z.output<typeof resumePatchSchema>

/** `GET /api/resumes` satırı. */
export interface LibraryResume {
  id: string
  label: string | null
  fileName: string | null
  createdAt: string
  isDefault: boolean
}
```

`features/analysis/schema.ts` içinde `const resumeFileSchema` ve `const jobTextSchema` başlarına `export` ekle.

`server/upload.ts` dosyasının sonuna ekle; `resumeFileSchema` ve `jobTextSchema`'yı `@/features/analysis/schema`'dan içe aktar:

```ts
/** Kütüphaneye yüklemede yalnızca dosya doğrulanıyor. */
export function validateResumeFile(file: unknown): void {
  const parsed = resumeFileSchema.safeParse(file)
  if (!parsed.success) {
    const { message, code } = firstIssue(parsed.error)
    throw new PermanentError(message, code)
  }
}

/** Kayıtlı CV ile analizde yalnızca ilan metni doğrulanıyor. */
export function validateJobText(jobText: string): string {
  const parsed = jobTextSchema.safeParse(jobText)
  if (!parsed.success) {
    const { message, code } = firstIssue(parsed.error)
    throw new PermanentError(message, code)
  }
  return parsed.data
}
```

- [ ] **Step 4: Testlerin geçtiğini gör.**

Run: `cd apps/web && pnpm exec vitest run src/features/onboarding src/features/resumes src/server/upload.test.ts && pnpm typecheck`
Expected: PASS, typecheck hatasız.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/features/onboarding/schema.ts apps/web/src/features/onboarding/schema.test.ts apps/web/src/features/resumes/schema.ts apps/web/src/features/resumes/schema.test.ts apps/web/src/features/analysis/schema.ts apps/web/src/server/upload.ts apps/web/src/server/upload.test.ts
git commit -m "Profil ve CV kütüphanesi şemaları (DOG-52)"
```

---

### Task 3: Kütüphane kuralları ve veritabanı işlemleri

**Files:**
- Create: `apps/web/src/server/resumeLibrary.ts`
- Create: `apps/web/src/server/resumeLibrary.test.ts` (saf kurallar)
- Create: `apps/web/src/server/resumeLibrary.integration.test.ts`

**Interfaces:**
- Consumes: `LIBRARY_MAX`, `LibraryResume`, `ResumePatch` (Task 2); `AuthError` (`@/server/authz`)
- Produces:
  - `canSave(savedCount: number): boolean`
  - `isFirstSaved(savedCount: number): boolean`
  - `nextDefaultId(remaining: { id: string; savedAt: Date }[]): string | null`
  - `listLibrary(db, userId): Promise<LibraryResume[]>`
  - `countLibrary(db, userId): Promise<number>`
  - `findLibraryResume(db, userId, resumeId): Promise<{ id: string }>`: bulunamazsa ya da sahibi başkasıysa `AuthError` 404 fırlatır.
  - `createResume(db, input: { userId: string; filePath: string; fileName: string; saveToLibrary: boolean | "required" }): Promise<{ resumeId: string; savedToLibrary: boolean }>`
  - `updateLibraryResume(db, userId, resumeId, patch: ResumePatch): Promise<LibraryResume>`
  - `removeFromLibrary(db, userId, resumeId): Promise<void>`
  - `LibraryFullError` (PermanentError, kod `library_full`)

- [ ] **Step 1: Saf kurallar için başarısız test.** `server/resumeLibrary.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { canSave, isFirstSaved, nextDefaultId } from "@/server/resumeLibrary"

describe("library rules", () => {
  it("allows saving up to five CVs", () => {
    expect(canSave(0)).toBe(true)
    expect(canSave(4)).toBe(true)
    expect(canSave(5)).toBe(false)
  })

  it("makes the first saved CV the default", () => {
    expect(isFirstSaved(0)).toBe(true)
    expect(isFirstSaved(1)).toBe(false)
  })

  it("hands the default to the newest remaining CV, or nobody", () => {
    const old = { id: "old", savedAt: new Date("2026-10-01") }
    const fresh = { id: "new", savedAt: new Date("2026-10-05") }
    expect(nextDefaultId([old, fresh])).toBe("new")
    expect(nextDefaultId([])).toBeNull()
  })
})
```

- [ ] **Step 2: Tümleşik test için başarısız test.** `server/resumeLibrary.integration.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"
import { prisma } from "@uyarla/db"
import { AuthError } from "@/server/authz"
import { deletionOperations } from "@/server/deleteAccount"
import {
  LibraryFullError,
  createResume,
  findLibraryResume,
  listLibrary,
  removeFromLibrary,
  updateLibraryResume,
} from "@/server/resumeLibrary"

const toClean: string[] = []

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function makeUser(name: string) {
  const u = await prisma.user.create({
    data: { name, email: `${name}-${Date.now()}-${Math.random()}@test.local` },
  })
  toClean.push(u.id)
  return u
}

function save(userId: string, fileName: string) {
  return createResume(prisma, { userId, filePath: `/tmp/${Math.random()}.pdf`, fileName, saveToLibrary: true })
}

describe("resume library", () => {
  it("saves the first CV as default and keeps one default", async () => {
    const u = await makeUser("lib-a")
    const first = await save(u.id, "a.pdf")
    const second = await save(u.id, "b.pdf")
    expect(first.savedToLibrary).toBe(true)

    let rows = await listLibrary(prisma, u.id)
    expect(rows.find((r) => r.id === first.resumeId)?.isDefault).toBe(true)
    expect(rows.filter((r) => r.isDefault)).toHaveLength(1)

    await updateLibraryResume(prisma, u.id, second.resumeId, { isDefault: true })
    rows = await listLibrary(prisma, u.id)
    expect(rows.filter((r) => r.isDefault).map((r) => r.id)).toEqual([second.resumeId])
  })

  it("does not save a sixth CV but still creates the resume for the analysis", async () => {
    const u = await makeUser("lib-b")
    for (let i = 0; i < 5; i++) await save(u.id, `${i}.pdf`)
    const sixth = await save(u.id, "6.pdf")
    expect(sixth.savedToLibrary).toBe(false)
    expect(await prisma.resume.count({ where: { id: sixth.resumeId } })).toBe(1)
    expect(await listLibrary(prisma, u.id)).toHaveLength(5)
  })

  it("throws LibraryFullError when adding directly to a full library", async () => {
    const u = await makeUser("lib-c")
    for (let i = 0; i < 5; i++) await save(u.id, `${i}.pdf`)
    await expect(
      createResume(prisma, { userId: u.id, filePath: "/tmp/x.pdf", fileName: "x.pdf", saveToLibrary: "required" }),
    ).rejects.toBeInstanceOf(LibraryFullError)
  })

  it("hides other users' and removed CVs behind 404", async () => {
    const owner = await makeUser("lib-d")
    const other = await makeUser("lib-e")
    const { resumeId } = await save(owner.id, "a.pdf")

    await expect(findLibraryResume(prisma, other.id, resumeId)).rejects.toMatchObject({ status: 404 })
    await removeFromLibrary(prisma, owner.id, resumeId)
    await expect(findLibraryResume(prisma, owner.id, resumeId)).rejects.toBeInstanceOf(AuthError)
    await expect(removeFromLibrary(prisma, other.id, resumeId)).rejects.toMatchObject({ status: 404 })
  })

  it("removing keeps the resume and its analyses, and hands the default over", async () => {
    const u = await makeUser("lib-f")
    const first = await save(u.id, "a.pdf")
    const second = await save(u.id, "b.pdf")
    const version = await prisma.resumeVersion.create({
      data: { resumeId: first.resumeId, profile: {}, source: "parsed", versionNo: 1 },
    })
    const posting = await prisma.jobPosting.create({
      data: { userId: u.id, rawText: "ilan", requirements: [], language: "tr" },
    })
    const analysis = await prisma.analysis.create({
      data: { userId: u.id, jobPostingId: posting.id, resumeVersionId: version.id, modelId: "t", status: "done" },
    })

    await removeFromLibrary(prisma, u.id, first.resumeId)

    expect(await prisma.analysis.count({ where: { id: analysis.id } })).toBe(1)
    const rows = await listLibrary(prisma, u.id)
    expect(rows.map((r) => r.id)).toEqual([second.resumeId])
    expect(rows[0]!.isDefault).toBe(true)
  })

  it("an analysis-only resume is not in the library", async () => {
    const u = await makeUser("lib-g")
    const { resumeId, savedToLibrary } = await createResume(prisma, {
      userId: u.id,
      filePath: "/tmp/a.pdf",
      fileName: "a.pdf",
      saveToLibrary: false,
    })
    expect(savedToLibrary).toBe(false)
    await expect(findLibraryResume(prisma, u.id, resumeId)).rejects.toMatchObject({ status: 404 })
  })
})
```

`saveToLibrary` üç değer alıyor:
- `false`: kaydetme.
- `true`: kütüphanede yer varsa kaydet, yoksa sessizce geç (analiz akışı).
- `"required"`: kütüphanede yer yoksa `LibraryFullError` fırlat (`POST /api/resumes`).

- [ ] **Step 3: Testlerin başarısız olduğunu gör.**

Run: `cd apps/web && pnpm exec vitest run src/server/resumeLibrary.test.ts && pnpm test:integration -- src/server/resumeLibrary.integration.test.ts`
Expected: FAIL, modül yok.

- [ ] **Step 4: Modülü yaz.** `server/resumeLibrary.ts`:

```ts
import { PermanentError } from "@uyarla/core"
import type { prisma } from "@uyarla/db"
import { LIBRARY_MAX, type LibraryResume, type ResumePatch } from "@/features/resumes/schema"
import { AuthError } from "@/server/authz"

type Db = typeof prisma

/**
 * CV kütüphanesi (DOG-50, spec §2 ve §4). Kütüphane ayrı bir tablo değil:
 * `Resume.savedAt` doluysa CV kütüphanede. Analizde yüklenip kaydedilmeyen
 * CV'ler de Resume satırı, ama listede görünmüyor.
 *
 * Kurallar saf fonksiyonlarda; sayım ve yazma aynı transaction'da, böylece
 * iki istek aynı anda 6. CV'yi kaydedemiyor ve iki varsayılan oluşmuyor.
 */

export class LibraryFullError extends PermanentError {
  constructor() {
    super(`En fazla ${LIBRARY_MAX} CV kaydedebilirsin. Birini kaldırıp tekrar dener misin?`, "library_full")
  }
}

export function canSave(savedCount: number): boolean {
  return savedCount < LIBRARY_MAX
}

export function isFirstSaved(savedCount: number): boolean {
  return savedCount === 0
}

/** Varsayılan kaldırılınca en yeni kayıtlı CV devralıyor; kimse kalmadıysa yok. */
export function nextDefaultId(remaining: { id: string; savedAt: Date }[]): string | null {
  if (remaining.length === 0) return null
  return [...remaining].sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime())[0]!.id
}

const LIBRARY_SELECT = { id: true, label: true, fileName: true, createdAt: true, isDefault: true } as const

function toLibraryResume(row: {
  id: string
  label: string | null
  fileName: string | null
  createdAt: Date
  isDefault: boolean
}): LibraryResume {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

/** Varsayılan önce, sonra en yeni kaydedilen. */
export async function listLibrary(db: Db, userId: string): Promise<LibraryResume[]> {
  const rows = await db.resume.findMany({
    where: { userId, savedAt: { not: null } },
    orderBy: [{ isDefault: "desc" }, { savedAt: "desc" }],
    select: LIBRARY_SELECT,
  })
  return rows.map(toLibraryResume)
}

export function countLibrary(db: Db, userId: string): Promise<number> {
  return db.resume.count({ where: { userId, savedAt: { not: null } } })
}

/**
 * Kullanıcının kütüphanesindeki CV. Başkasınınki, kaldırılmış ya da hiç
 * kaydedilmemiş CV aynı 404'ü veriyor (K-35: var olduğunu sızdırma).
 */
export async function findLibraryResume(db: Db, userId: string, resumeId: string): Promise<{ id: string }> {
  const row = await db.resume.findFirst({
    where: { id: resumeId, userId, savedAt: { not: null } },
    select: { id: true },
  })
  if (!row) throw new AuthError("Bulunamadı.", 404, "not_found")
  return row
}

/**
 * Yeni Resume satırı. `saveToLibrary`:
 * - `false`: yalnızca analiz için.
 * - `true`: yer varsa kütüphaneye; doluysa kaydetmeden devam (analiz engellenmesin).
 * - `"required"`: doluysa LibraryFullError (kütüphaneye doğrudan yükleme).
 */
export async function createResume(
  db: Db,
  input: { userId: string; filePath: string; fileName: string; saveToLibrary: boolean | "required" },
): Promise<{ resumeId: string; savedToLibrary: boolean }> {
  return db.$transaction(async (tx) => {
    let save = false
    let makeDefault = false
    if (input.saveToLibrary) {
      const savedCount = await tx.resume.count({ where: { userId: input.userId, savedAt: { not: null } } })
      if (canSave(savedCount)) {
        save = true
        makeDefault = isFirstSaved(savedCount)
      } else if (input.saveToLibrary === "required") {
        throw new LibraryFullError()
      }
    }
    const row = await tx.resume.create({
      data: {
        userId: input.userId,
        filePath: input.filePath,
        fileName: input.fileName,
        rawText: "",
        savedAt: save ? new Date() : null,
        isDefault: makeDefault,
      },
      select: { id: true },
    })
    return { resumeId: row.id, savedToLibrary: save }
  })
}

export async function updateLibraryResume(
  db: Db,
  userId: string,
  resumeId: string,
  patch: ResumePatch,
): Promise<LibraryResume> {
  return db.$transaction(async (tx) => {
    await findLibraryResume(tx as Db, userId, resumeId)
    if (patch.isDefault) {
      await tx.resume.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
    }
    const row = await tx.resume.update({
      where: { id: resumeId },
      data: {
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.isDefault ? { isDefault: true } : {}),
      },
      select: LIBRARY_SELECT,
    })
    return toLibraryResume(row)
  })
}

/** Yalnızca kütüphaneden çıkarıyor; satır ve bağlı analizler kalıyor. */
export async function removeFromLibrary(db: Db, userId: string, resumeId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    await findLibraryResume(tx as Db, userId, resumeId)
    await tx.resume.update({ where: { id: resumeId }, data: { savedAt: null, isDefault: false } })
    const hasDefault = await tx.resume.count({ where: { userId, savedAt: { not: null }, isDefault: true } })
    if (hasDefault > 0) return
    const remaining = await tx.resume.findMany({
      where: { userId, savedAt: { not: null } },
      select: { id: true, savedAt: true },
    })
    const heir = nextDefaultId(remaining.map((r) => ({ id: r.id, savedAt: r.savedAt! })))
    if (heir) await tx.resume.update({ where: { id: heir }, data: { isDefault: true } })
  })
}
```

- [ ] **Step 5: Testlerin geçtiğini gör.**

Run: `cd apps/web && pnpm exec vitest run src/server/resumeLibrary.test.ts && pnpm test:integration -- src/server/resumeLibrary.integration.test.ts && pnpm typecheck`
Expected: PASS. `tx as Db` tip hatası verirse `findLibraryResume`'ün `db` parametresini `Pick<Db, "resume">` yap.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/server/resumeLibrary.ts apps/web/src/server/resumeLibrary.test.ts apps/web/src/server/resumeLibrary.integration.test.ts
git commit -m "CV kütüphanesi kuralları ve veritabanı işlemleri (DOG-52)"
```

---

### Task 4: Profil modülü ve `PATCH /api/profile`

**Files:**
- Create: `apps/web/src/server/profile.ts`
- Create: `apps/web/src/server/profile.integration.test.ts`
- Create: `apps/web/src/app/api/profile/route.ts`

**Interfaces:**
- Consumes: `ProfilePatch`, `profilePatchSchema` (Task 2); `firstIssue`; `ensureRegistered`, `getSession`, `authErrorResponse`
- Produces:
  - `interface Profile { name: string; email: string; goal: Goal | null; targetRole: string | null; onboardedAt: Date | null }`
  - `getProfile(db, userId): Promise<Profile | null>`
  - `updateProfile(db, userId, patch: ProfilePatch): Promise<Profile>`

- [ ] **Step 1: Başarısız test.** `server/profile.integration.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import { getProfile, updateProfile } from "@/server/profile"

const toClean: string[] = []
afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function makeUser() {
  const u = await prisma.user.create({ data: { name: "", email: `p-${Date.now()}-${Math.random()}@test.local` } })
  toClean.push(u.id)
  return u
}

describe("profile", () => {
  it("updates only the fields sent", async () => {
    const u = await makeUser()
    await updateProfile(prisma, u.id, { name: "Doğanay", goal: "first_job" })
    await updateProfile(prisma, u.id, { targetRole: "Frontend geliştirici" })
    expect(await getProfile(prisma, u.id)).toMatchObject({
      name: "Doğanay",
      goal: "first_job",
      targetRole: "Frontend geliştirici",
      onboardedAt: null,
    })
  })

  it("keeps the first onboarding date when completed twice", async () => {
    const u = await makeUser()
    const first = await updateProfile(prisma, u.id, { completeOnboarding: true })
    const second = await updateProfile(prisma, u.id, { completeOnboarding: true })
    expect(first.onboardedAt).not.toBeNull()
    expect(second.onboardedAt?.getTime()).toBe(first.onboardedAt?.getTime())
  })

  it("returns null for an unknown user", async () => {
    expect(await getProfile(prisma, "yok")).toBeNull()
  })
})
```

- [ ] **Step 2: Başarısız olduğunu gör.**

Run: `cd apps/web && pnpm test:integration -- src/server/profile.integration.test.ts`
Expected: FAIL, modül yok.

- [ ] **Step 3: Modülü ve route'u yaz.** `server/profile.ts`:

```ts
import type { prisma } from "@uyarla/db"
import type { Goal, ProfilePatch } from "@/features/onboarding/schema"

type Db = typeof prisma

/**
 * Profil: ad, amaç, hedef rol ve onboarding durumu (DOG-50). Better Auth
 * oturumuna eklenmiyor; sunucu bileşenleri buradan tek sorguyla okuyor.
 */
export interface Profile {
  name: string
  email: string
  goal: Goal | null
  targetRole: string | null
  onboardedAt: Date | null
}

const PROFILE_SELECT = { name: true, email: true, goal: true, targetRole: true, onboardedAt: true } as const

export function getProfile(db: Db, userId: string): Promise<Profile | null> {
  return db.user.findUnique({ where: { id: userId }, select: PROFILE_SELECT })
}

export async function updateProfile(db: Db, userId: string, patch: ProfilePatch): Promise<Profile> {
  const current = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { onboardedAt: true } })
  return db.user.update({
    where: { id: userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.goal !== undefined ? { goal: patch.goal } : {}),
      ...(patch.targetRole !== undefined ? { targetRole: patch.targetRole } : {}),
      // İlk tamamlanma tarihi korunuyor: ikinci "Şimdilik geç" onu kaydırmasın.
      ...(patch.completeOnboarding && !current.onboardedAt ? { onboardedAt: new Date() } : {}),
    },
    select: PROFILE_SELECT,
  })
}
```

`app/api/profile/route.ts`:

```ts
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { profilePatchSchema } from "@/features/onboarding/schema"
import { firstIssue } from "@/lib/validation"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { updateProfile } from "@/server/profile"

export const runtime = "nodejs"

/** Ad, amaç, hedef rol; onboarding'i tamamlandı işaretler. Kimlik oturumdan. */
export async function PATCH(request: Request) {
  try {
    const { user } = ensureRegistered(await getSession())
    const parsed = profilePatchSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })
    }
    const profile = await updateProfile(prisma, user.id, parsed.data)
    return NextResponse.json({ profile })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/profile]", error)
    return NextResponse.json({ error: "Profilini kaydedemedik. Birazdan tekrar dener misin?" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Testlerin geçtiğini gör.**

Run: `cd apps/web && pnpm test:integration -- src/server/profile.integration.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/server/profile.ts apps/web/src/server/profile.integration.test.ts apps/web/src/app/api/profile/route.ts
git commit -m "Profil modülü ve PATCH /api/profile (DOG-52)"
```

---

### Task 5: `/api/resumes` uçları

**Files:**
- Create: `apps/web/src/app/api/resumes/route.ts`
- Create: `apps/web/src/app/api/resumes/[id]/route.ts`

**Interfaces:**
- Consumes: Task 3'ün tamamı; `validateResumeFile` (Task 2); `resumePatchSchema`, `labelSchema`; `fileStoreFromEnv`
- Produces:
  - `GET /api/resumes` → `{ resumes: LibraryResume[] }`
  - `POST /api/resumes` (çok parçalı: `cv`, `label?`) → `{ resume: LibraryResume }`, 400 `library_full`
  - `PATCH /api/resumes/[id]` → `{ resume }`
  - `DELETE /api/resumes/[id]` → `{ removed: true }`

- [ ] **Step 1: Listeleme ve yükleme route'unu yaz.** `app/api/resumes/route.ts`:

```ts
import { fileStoreFromEnv, PermanentError } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { labelSchema } from "@/features/resumes/schema"
import { firstIssue } from "@/lib/validation"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { LibraryFullError, canSave, countLibrary, createResume, listLibrary } from "@/server/resumeLibrary"
import { validateResumeFile } from "@/server/upload"

export const runtime = "nodejs"

export async function GET() {
  try {
    const { user } = ensureRegistered(await getSession())
    return NextResponse.json({ resumes: await listLibrary(prisma, user.id) })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/resumes]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/** Kütüphaneye CV yükler (onboarding ve hesabım). Doluysa dosya depoya hiç yazılmıyor. */
export async function POST(request: Request) {
  try {
    const { user } = ensureRegistered(await getSession())
    const form = await request.formData()
    const file = form.get("cv")
    validateResumeFile(file)
    if (!(file instanceof File)) {
      throw new PermanentError("CV'ni seçer misin? PDF ya da DOCX olabilir.", "missing_file")
    }
    const label = labelSchema.safeParse(String(form.get("label") ?? ""))
    if (!label.success) throw new PermanentError(firstIssue(label.error).message, "invalid_label")

    if (!canSave(await countLibrary(prisma, user.id))) throw new LibraryFullError()

    const filePath = await fileStoreFromEnv().save(Buffer.from(await file.arrayBuffer()), file.name)
    const { resumeId } = await createResume(prisma, {
      userId: user.id,
      filePath,
      fileName: file.name,
      saveToLibrary: "required",
    })
    if (label.data) await prisma.resume.update({ where: { id: resumeId }, data: { label: label.data } })

    const resume = (await listLibrary(prisma, user.id)).find((r) => r.id === resumeId)
    return NextResponse.json({ resume })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    if (error instanceof PermanentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error("[api/resumes]", error)
    return NextResponse.json({ error: "CV'ni kaydedemedik. Birazdan tekrar dener misin?" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Tekil route'u yaz.** `app/api/resumes/[id]/route.ts`:

```ts
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { resumePatchSchema } from "@/features/resumes/schema"
import { firstIssue } from "@/lib/validation"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { removeFromLibrary, updateLibraryResume } from "@/server/resumeLibrary"

export const runtime = "nodejs"

type Params = { params: Promise<{ id: string }> }

/** Etiket ve/veya varsayılan yapma. Başkasının ya da kütüphanede olmayan CV 404. */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  try {
    const { user } = ensureRegistered(await getSession())
    const parsed = resumePatchSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssue(parsed.error).message }, { status: 400 })
    }
    return NextResponse.json({ resume: await updateLibraryResume(prisma, user.id, id, parsed.data) })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/resumes/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}

/** Kütüphaneden kaldırır; CV'yle yapılmış analizler panoda kalıyor. */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  try {
    const { user } = ensureRegistered(await getSession())
    await removeFromLibrary(prisma, user.id, id)
    return NextResponse.json({ removed: true })
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    console.error("[api/resumes/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
```

- [ ] **Step 3: Typecheck ve anonim erişimi HTTP ile dene.**

Run: `cd apps/web && pnpm typecheck`, ardından dev sunucusu açıkken:

```bash
curl -s http://localhost:3000/api/resumes
curl -s -X PATCH http://localhost:3000/api/profile -H 'content-type: application/json' -d '{"name":"x"}'
```

Expected: ikisi de `{"error":"Devam etmek için giriş yapman gerekiyor.","code":"no_session"}`.

- [ ] **Step 4: Commit.**

```bash
git add apps/web/src/app/api/resumes/route.ts "apps/web/src/app/api/resumes/[id]/route.ts"
git commit -m "CV kütüphanesi uçları: /api/resumes (DOG-52)"
```

---

### Task 6: `POST /api/analyze`: kayıtlı CV ve "kütüphaneme kaydet"

**Files:**
- Modify: `apps/web/src/app/api/analyze/route.ts` (POST gövdesi)

**Interfaces:**
- Consumes: `findLibraryResume`, `createResume` (Task 3); `validateJobText`, `validateUpload` (Task 2)
- Produces: İstek alanları `resumeId?` ya da `cv` + `saveToLibrary?` (`"true"`). Yanıt: `{ jobId: string; savedToLibrary?: boolean }`; `savedToLibrary` yalnızca `saveToLibrary` istendiğinde gelir.

- [ ] **Step 1: Route'u değiştir.** `POST` içindeki `form` okumasından `job` oluşturmaya kadar olan bölümü şununla değiştir. `catch` bloğu aynı kalıyor.

```ts
    const form = await request.formData()
    const resumeIdField = form.get("resumeId")
    const libraryResumeId = typeof resumeIdField === "string" && resumeIdField ? resumeIdField : null
    const file = form.get("cv")

    // İki yol: kütüphanedeki CV (dosya yok) ya da yeni dosya. Doğrulama
    // oturumdan önce: geçersiz istek için anonim kullanıcı açılmasın.
    let jobText: string
    if (libraryResumeId) {
      jobText = validateJobText(String(form.get("jobText") ?? ""))
    } else {
      jobText = validateUpload(file, String(form.get("jobText") ?? "")).jobText
      if (!(file instanceof File)) {
        throw new PermanentError("CV'ni seçer misin? PDF ya da DOCX olabilir.", "missing_file")
      }
    }

    // Oturum yoksa anonim aç (spec §7). signInAnonymous'un kendi yanıtı
    // kullanılıyor: yeni çerez ancak sonraki istekte görünür.
    let session = await getSession()
    if (!session && !libraryResumeId) {
      const fresh = await auth.api.signInAnonymous({ headers: await headers() })
      session = fresh?.user ? { user: { id: fresh.user.id, isAnonymous: true } } : null
    }
    // Kütüphane yalnızca kayıtlı kullanıcıya açık.
    const { user } = libraryResumeId ? ensureRegistered(session) : ensureSession(session)

    // Pahalı uç: her çağrı ~60 saniyelik LLM işi başlatıyor (spec §9).
    await enforceRateLimit(
      redisStore,
      `analiz:${user.id}`,
      user.isAnonymous ? RATE_LIMITS.anonUser : RATE_LIMITS.registered,
    )

    let resumeId: string
    let savedToLibrary: boolean | undefined
    if (libraryResumeId) {
      // Aynı Resume satırı: worker rawText önbelleğini kullanıyor, dosya
      // yeniden okunmuyor. Başkasının ya da kaldırılmış CV 404 (K-35).
      resumeId = (await findLibraryResume(prisma, user.id, libraryResumeId)).id
    } else {
      const upload = file as File
      // Metin çıkarma worker'da (spec §4.2); pdfjs Next'in sunucu katmanında yüklenemiyor.
      const filePath = await fileStoreFromEnv().save(Buffer.from(await upload.arrayBuffer()), upload.name)
      const wantsSave = form.get("saveToLibrary") === "true" && !user.isAnonymous
      const created = await createResume(prisma, {
        userId: user.id,
        filePath,
        fileName: upload.name,
        saveToLibrary: wantsSave,
      })
      resumeId = created.resumeId
      if (wantsSave) savedToLibrary = created.savedToLibrary
    }

    const posting = await prisma.jobPosting.create({
      data: { userId: user.id, rawText: jobText, requirements: [], language: "tr" },
    })

    const job = await analyzeQueue.add(
      "analyze",
      { resumeId, jobPostingId: posting.id, userId: user.id },
      ANALYZE_JOB_OPTIONS,
    )

    return NextResponse.json({ jobId: job.id, ...(savedToLibrary !== undefined ? { savedToLibrary } : {}) })
```

Import'ları güncelle:
- `ensureRegistered`'ı `@/server/authz` importuna ekle.
- `import { createResume, findLibraryResume } from "@/server/resumeLibrary"` ekle.
- `validateUpload` importunu `import { validateJobText, validateUpload } from "@/server/upload"` yap.

Eski uzun yorumlardaki bilgi kısaltılmış hâlleriyle yukarıda duruyor.

**Davranış değişikliği:** Eskiden dosya, oturum açılmadan önce depoya yazılıyordu. Artık önce doğrulama, sonra oturum, sonra depoya yazma geliyor. Bu kasıtlı: hız limitine takılan istek de artık depoya dosya bırakmıyor.

- [ ] **Step 2: Typecheck ve birim testleri.**

Run: `cd apps/web && pnpm typecheck && pnpm test`
Expected: hatasız, bütün testler PASS.

- [ ] **Step 3: HTTP ile dene** (dev sunucusu açık; R2 yerine yerel depo için `.env`'de `S3_BUCKET` geçici olarak yorum satırına alınabilir):

```bash
B=http://localhost:3000
# Anonim kullanıcı + kayıtlı CV → 401 registration_required
curl -s -X POST $B/api/analyze -F "resumeId=abc" -F "jobText=<packages/core/eval/sources/ilan/ilan-1.txt"
# Anonim kullanıcı + saveToLibrary → analiz başlar, savedToLibrary alanı yok
curl -s -X POST $B/api/analyze -F "cv=@docs/cvler/cv2.pdf" -F "saveToLibrary=true" -F "jobText=<packages/core/eval/sources/ilan/ilan-1.txt"
# Kayıtlı CV + kısa ilan → 400 job_text_too_short (oturumdan önce)
curl -s -X POST $B/api/analyze -F "resumeId=abc" -F "jobText=kısa"
```

Expected sırasıyla:
- `{"error":"CV'ni uyarlamak için…","code":"registration_required"}`
- `{"jobId":"…"}`
- `{"error":"İlan metni çok kısa…","code":"job_text_too_short"}`

- [ ] **Step 4: Kayıtlı kullanıcıyla uçtan uca dene.** Test oturumu açmak için magic link'i konsoldan al: `RESEND_API_KEY` boşken bağlantı dev günlüğüne yazılıyor.

Akış şöyle:
1. Bağlantıyı aç; çerez kavanoza (`-c jar`) kaydedilsin.
2. `POST /api/resumes` ile `cv2.pdf` yükle. Expected: `isDefault: true`.
3. Dönen `id` ile `POST /api/analyze` çağır: `resumeId=<id>`. Expected: `jobId` döner.
4. Veritabanında yeni `Resume` açılmadığını doğrula:
   `docker exec uyarla-postgres-1 psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c 'select count(*) from "Resume" where "userId"=…'`
5. Altıncı CV'yi `POST /api/resumes` ile yükle (önce 5'e tamamla). Expected: 400 `library_full`.
6. `PATCH /api/profile` gövdesi `{"name":"Test","completeOnboarding":true}`. Expected: `profile.onboardedAt` dolu.

Sonuçları PR açıklamasına yaz.

- [ ] **Step 5: Tümleşik testlerin hepsini koş ve commit et.**

Run: `cd apps/web && pnpm test:integration`
Expected: PASS. Hesap silme testi kütüphaneli CV'leri de sildiğini kapsıyor, çünkü bunlar da `Resume` satırı.

```bash
git add apps/web/src/app/api/analyze/route.ts
git commit -m "Analiz: kayıtlı CV ile ve kütüphaneye kaydederek (DOG-52)"
```

---

### Task 7: PR, prod migration, Linear

- [ ] **Step 1: Son doğrulama.** Run: `pnpm -r typecheck && pnpm -r test && (cd apps/web && pnpm test:integration)`. Expected: hepsi PASS.
- [ ] **Step 2: PR aç.** Başlık: "Onboarding 1/4: veri modeli ve API (DOG-52)". Açıklamaya şunları yaz: uç listesi, `fileName` sapması, HTTP deneme sonuçları, prod migration notu.
- [ ] **Step 3: Merge'den önce prod'a migration uygula.** Migration yalnızca ekleme yapıyor; eski kodla da uyumlu.

Run: `cd packages/db && DATABASE_URL='<Neon pooler adresi>' pnpm exec prisma migrate deploy`
Expected: `1 migration applied`.

Neon adresi kullanıcıdan alındı; kullanıcı aksini söylemedikçe bu adımı uygula.
- [ ] **Step 4: Linear.** DOG-52'yi In Review yap, PR bağlantısını ekle. Merge'den sonra Done yap ve DOG-53'e geç.
