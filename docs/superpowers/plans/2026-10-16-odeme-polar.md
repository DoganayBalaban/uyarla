# Ödeme ve Erişim Dönemi (Polar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kayıtlı kullanıcı ilk uyarlamasını ücretsiz yapıyor; ikincisinde Polar'dan tek seferlik bir erişim dönemi (1 hafta / 1 ay / 3 ay) satın alıp devam ediyor.

**Architecture:** Dönemler bizim veritabanımızda (`AccessPass`). Polar yalnızca ödeme alıp bildirim gönderiyor ve bir sağlayıcı arayüzünün (`BillingProvider`) arkasında duruyor. Yetki kararı saf bir fonksiyonda (`canAdapt`), `POST /api/adapt`'in başında uygulanıyor. Ödeme uçları tek route dosyasında (`/api/billing/[action]`), çünkü Vercel Hobby 12 fonksiyon sınırının kenarındayız.

**Tech Stack:** Next 15 (App Router), Prisma 5 (Postgres/Neon), `@polar-sh/sdk` 1.0.2 (`@polar-sh/sdk/2026-10`), vitest, React 18, axios + TanStack Query.

**Spec:** `docs/superpowers/specs/2026-10-16-odeme-polar-design.md`

## Global Constraints

- **İsimler ve metinler:** isimler İngilizce; yorumlar ve kullanıcıya görünen metinler Türkçe.
- **Git:** `git add` her zaman açık yollarla, dizin verilmez. Commit mesajı `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` ile biter.
- **Route sınırı:** yeni API route dosyası yalnızca bir tane: `apps/web/src/app/api/billing/[action]/route.ts`.
- **Ücretsiz plan:** sınırsız analiz (mevcut hız limitiyle) + **ömür boyu 1 uyarlama**, filigransız PDF/Word ve ön yazıyla.
- **Paketler:** `week` 7 gün, `month` 30 gün, `quarter` 90 gün; tek seferlik, otomatik yenileme yok. Aktif dönem varken alınan paket en geç bitişin üstüne eklenir.
- **Adil kullanım:** dönem içinde **son 24 saatte** en çok 30 uyarlama.
- **Ödeme duvarı yanıtı:** `402` + `{ code: "payment_required" | "daily_cap" }`.
- **Webhook:** imza geçersizse `403`, hiçbir şey yazılmaz. `providerOrderId` tekil; aynı sipariş ikinci kez gelirse `200` ve yok sayılır.
- **Önce sandbox:** `POLAR_SERVER` öntanımlı `sandbox`. Kart bilgisi uyarla'ya hiç gelmez.
- **Merge:** Vercel kontrolü SUCCESS olmadan merge yapılmaz. Üretim veritabanına göç `prisma migrate deploy` ile, merge'den önce.

## Review Focus

1. **Aynı ödeme bildiriminin iki kez gelmesi.** Polar, 2xx almazsa yeniden dener. Tek dönem açılmalı, ikinci istek `200` almalı (Task 3 ve 6 testleri).
2. **Üst üste alınmış iki paketten birinin iadesi.** Yalnızca iade edilen sipariş kapanmalı, diğer dönem açık kalmalı (Task 3 testi).
3. **Bildirimde bilinmeyen paket ya da kullanıcı.** `metadata.plan` yapılandırmada yoksa ya da kullanıcı silinmişse dönem açılmamalı, istek `200` dönmeli (Polar sonsuza dek denemesin) ve uyarı loglanmalı (Task 6 testi).
4. **Anonim kullanıcı ödeme başlatmaya çalışırsa** `401 registration_required` almalı, ödeme sayfası açılmamalı (Task 6 testi).
5. **Günlük tavan sınırı.** 30. uyarlama geçmeli, 31. `daily_cap` almalı; 24 saat önceki uyarlama sayılmamalı (Task 2 testi).

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `packages/db/prisma/schema.prisma` | `AccessPass` modeli ve `AccessPassStatus` enum'u |
| `packages/db/prisma/migrations/20261016120000_erisim_donemi/migration.sql` | Göç |
| `apps/web/src/server/deleteAccount.ts`, `dataExport.ts` | Hesap silme ve "Verilerimi indir"e `accessPass` |
| `apps/web/src/features/billing/plans.ts` | Paket listesi, süreler, ürün kimlikleri ve gösterim fiyatları (env'den) |
| `apps/web/src/features/billing/access.ts` | Saf: `canAdapt`, `extendPass`, `activePassEnd` |
| `apps/web/src/server/billing/entitlement.ts` | DB: `loadAccess`, `assertCanAdapt`, `applyBillingEvent` |
| `apps/web/src/server/billing/provider.ts` | `BillingProvider` arayüzü, `BillingEvent`, `WebhookSignatureError` |
| `apps/web/src/server/billing/polar.ts` | `createPolarProvider` (Polar SDK) |
| `apps/web/src/server/billing/handlers.ts` | Uçların mantığı: `handleCheckout`, `handleWebhook`, `handleStatus` |
| `apps/web/src/app/api/billing/[action]/route.ts` | İnce route: action'a göre handler |
| `apps/web/src/app/api/adapt/route.ts` | `assertCanAdapt` ve 402 |
| `apps/web/src/features/billing/api.ts` | İstemci: `createCheckout`, `useBillingStatus` |
| `apps/web/src/features/billing/paywall.ts` | `plansPath(returnTo)` |
| `apps/web/src/features/billing/components/PlansView.tsx`, `ThanksView.tsx`, `PassSection.tsx` | Arayüz |
| `apps/web/src/app/(app)/(focused)/plans/page.tsx`, `plans/tesekkurler/page.tsx` | Sayfalar |
| `apps/web/src/app/(marketing)/refund/page.tsx`, `terms/page.tsx`, `privacy/page.tsx` | Hukuki metinler |

---

### Task 1: `AccessPass` tablosu, hesap silme ve veri dışa aktarma

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261016120000_erisim_donemi/migration.sql`
- Modify: `apps/web/src/server/deleteAccount.ts:41-50`
- Modify: `apps/web/src/server/dataExport.ts:19-28, 38-46, collectUserData`
- Test: `apps/web/src/server/dataExport.test.ts` (mevcut eşitlik testi), `apps/web/src/server/deleteAccount.integration.test.ts`

**Interfaces:**
- Produces: Prisma `AccessPass { id, userId, plan: string, startsAt, endsAt, providerOrderId (unique), status: AccessPassStatus ("active" | "refunded"), createdAt }`; `prisma.accessPass`. `UserDataExport.accessPasses: Record<string, unknown>[]`.

- [ ] **Step 1: Şemaya modeli ekle.** `schema.prisma`'da `User` modeline `accessPasses AccessPass[]` satırını ekle, dosyanın sonuna:

```prisma
enum AccessPassStatus {
  active
  refunded
}

/// Ücretli erişim dönemi (DOG-34). Tek seferlik paket; otomatik yenileme yok.
/// Polar sipariş kimliği tekil: aynı ödeme bildirimi iki kez dönem açmaz.
model AccessPass {
  id              String           @id @default(cuid())
  userId          String
  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan            String
  startsAt        DateTime
  endsAt          DateTime
  providerOrderId String           @unique
  status          AccessPassStatus @default(active)
  createdAt       DateTime         @default(now())

  @@index([userId, endsAt])
}
```

- [ ] **Step 2: Göçü üret.**
  - Run: `cd packages/db && pnpm migrate --name erisim_donemi --create-only`
  - Oluşan klasörün adını `20261016120000_erisim_donemi` yap (projenin göç adlandırması). Sonra: `pnpm exec dotenv -e ../../.env -- prisma migrate dev`.
  - Expected: `Your database is now in sync with your schema`, `prisma generate` çalışır.

- [ ] **Step 3: Silme sırasına ekle, eşitlik testinin kırıldığını gör.** `deleteAccount.ts` `DELETION_ORDER` içinde `"account",` satırından sonra `"accessPass",` ekle (varsayılan koşul `userId`, `condition` değişmiyor).
  - Run: `cd apps/web && pnpm exec vitest run src/server/dataExport.test.ts`
  - Expected: FAIL. `EXPORTED_TABLES` ile `DELETION_ORDER` eşit değil (silinen her tablo dışa da aktarılmalı).

- [ ] **Step 4: Dışa aktarmaya ekle.** `dataExport.ts`:
  - `EXPORTED_TABLES` listesine `"accessPass",` ekle.
  - `UserDataExport`'a `accessPasses: Record<string, unknown>[]` alanını ekle.
  - `collectUserData` içindeki `Promise.all`'a şu sorguyu ekle:

```ts
    db.accessPass.findMany({
      where: { userId },
      select: { plan: true, startsAt: true, endsAt: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
```

    Sonucu `accessPasses` olarak döndür. Sipariş kimliği dışa aktarılmıyor: kişinin verisi değil, sağlayıcının iç anahtarı.

- [ ] **Step 5: Testler yeşil.**
  - Run: `cd apps/web && pnpm exec vitest run src/server/dataExport.test.ts src/server/deleteAccount.test.ts && pnpm exec tsc --noEmit`
  - Expected: PASS, tsc temiz.

- [ ] **Step 6: Silme tümleşik testine dönem ekle.** `deleteAccount.integration.test.ts`'te kullanıcının tam zincirini kuran yardımcıya bir `accessPass` kaydı ekle (`providerOrderId: \`test-${userId}\``, `plan: "month"`, `startsAt: new Date()`, `endsAt: new Date(Date.now() + 864e5)`). Silmeden sonra `prisma.accessPass.count({ where: { userId } })` için `0` beklentisi ekle.
  - Run: `cd apps/web && S3_BUCKET= pnpm exec dotenv -e ../../.env -- sh -c 'S3_BUCKET= vitest run --config vitest.integration.config.ts src/server/deleteAccount.integration.test.ts'`
  - Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261016120000_erisim_donemi/migration.sql apps/web/src/server/deleteAccount.ts apps/web/src/server/dataExport.ts apps/web/src/server/deleteAccount.integration.test.ts
git commit -m "Erişim dönemi tablosu; hesap silme ve veri dışa aktarmaya dahil (DOG-34)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Paketler ve saf yetki mantığı

**Files:**
- Create: `apps/web/src/features/billing/plans.ts`, `apps/web/src/features/billing/access.ts`
- Test: `apps/web/src/features/billing/plans.test.ts`, `apps/web/src/features/billing/access.test.ts`

**Interfaces:**
- Produces:
  - `type PlanKey = "week" | "month" | "quarter"`
  - `PLAN_DAYS: Record<PlanKey, number>` (7, 30, 90)
  - `isPlanKey(value: unknown): value is PlanKey`
  - `interface PlanOffer { key: PlanKey; days: number; productId: string; priceTry: number | null }`
  - `plansFromEnv(env: Record<string, string | undefined>): PlanOffer[]`: ürün kimliği boş olan paket listede yok.
  - `interface PassLike { status: "active" | "refunded"; startsAt: Date; endsAt: Date }`
  - `FREE_ADAPTATIONS = 1`, `DAILY_CAP = 30`
  - `canAdapt(input: { adaptationsUsed: number; adaptationsLast24h: number; passes: PassLike[]; now: Date }): { allowed: true; via: "free" | "pass" } | { allowed: false; reason: "payment_required" | "daily_cap" }`
  - `activePassEnd(passes: PassLike[], now: Date): Date | null`
  - `extendPass(passes: PassLike[], plan: PlanKey, now: Date): { startsAt: Date; endsAt: Date }`

- [ ] **Step 1: Testleri yaz.** `apps/web/src/features/billing/access.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { activePassEnd, canAdapt, extendPass, type PassLike } from "@/features/billing/access"

const NOW = new Date("2026-11-10T12:00:00Z")
const day = 864e5
const pass = (startOffsetDays: number, endOffsetDays: number, status: PassLike["status"] = "active"): PassLike => ({
  status,
  startsAt: new Date(NOW.getTime() + startOffsetDays * day),
  endsAt: new Date(NOW.getTime() + endOffsetDays * day),
})

describe("canAdapt", () => {
  it("allows the first adaptation for free", () => {
    expect(canAdapt({ adaptationsUsed: 0, adaptationsLast24h: 0, passes: [], now: NOW })).toEqual({ allowed: true, via: "free" })
  })

  it("asks for payment after the free adaptation", () => {
    expect(canAdapt({ adaptationsUsed: 1, adaptationsLast24h: 1, passes: [], now: NOW })).toEqual({
      allowed: false,
      reason: "payment_required",
    })
  })

  it("allows with an active pass", () => {
    expect(canAdapt({ adaptationsUsed: 5, adaptationsLast24h: 2, passes: [pass(-3, 4)], now: NOW })).toEqual({
      allowed: true,
      via: "pass",
    })
  })

  it("ignores expired and refunded passes", () => {
    const passes = [pass(-10, -1), pass(-2, 5, "refunded")]
    expect(canAdapt({ adaptationsUsed: 1, adaptationsLast24h: 0, passes, now: NOW }).allowed).toBe(false)
  })

  it("treats the end instant as expired", () => {
    expect(canAdapt({ adaptationsUsed: 1, adaptationsLast24h: 0, passes: [pass(-7, 0)], now: NOW }).allowed).toBe(false)
  })

  it("caps a pass at 30 adaptations in the last 24 hours", () => {
    // Review Focus 5: 30. geçer, 31. daily_cap.
    expect(canAdapt({ adaptationsUsed: 40, adaptationsLast24h: 29, passes: [pass(-1, 6)], now: NOW }).allowed).toBe(true)
    expect(canAdapt({ adaptationsUsed: 40, adaptationsLast24h: 30, passes: [pass(-1, 6)], now: NOW })).toEqual({
      allowed: false,
      reason: "daily_cap",
    })
  })
})

describe("activePassEnd", () => {
  it("is the latest end among active passes", () => {
    expect(activePassEnd([pass(-1, 3), pass(3, 33)], NOW)).toEqual(new Date(NOW.getTime() + 33 * day))
    expect(activePassEnd([pass(-10, -1)], NOW)).toBeNull()
  })
})

describe("extendPass", () => {
  it("starts now when there is no active pass", () => {
    expect(extendPass([], "week", NOW)).toEqual({ startsAt: NOW, endsAt: new Date(NOW.getTime() + 7 * day) })
  })

  it("stacks on top of the latest active end", () => {
    const end = new Date(NOW.getTime() + 4 * day)
    expect(extendPass([pass(-3, 4)], "month", NOW)).toEqual({ startsAt: end, endsAt: new Date(end.getTime() + 30 * day) })
  })

  it("does not stack on an expired or refunded pass", () => {
    expect(extendPass([pass(-10, -1), pass(-1, 9, "refunded")], "quarter", NOW).startsAt).toEqual(NOW)
  })
})
```

`apps/web/src/features/billing/plans.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { isPlanKey, plansFromEnv } from "@/features/billing/plans"

describe("plansFromEnv", () => {
  it("lists only the plans with a product id, with display prices", () => {
    expect(
      plansFromEnv({
        POLAR_PRODUCT_WEEK: "prod_w",
        POLAR_PRODUCT_MONTH: "prod_m",
        POLAR_PRODUCT_QUARTER: "",
        PLAN_PRICES_TRY: "week:149, month:349, quarter:799",
      }),
    ).toEqual([
      { key: "week", days: 7, productId: "prod_w", priceTry: 149 },
      { key: "month", days: 30, productId: "prod_m", priceTry: 349 },
    ])
  })

  it("leaves the price empty when it is not configured", () => {
    expect(plansFromEnv({ POLAR_PRODUCT_MONTH: "prod_m" })).toEqual([{ key: "month", days: 30, productId: "prod_m", priceTry: null }])
  })
})

describe("isPlanKey", () => {
  it("accepts only known plans", () => {
    expect(isPlanKey("month")).toBe(true)
    expect(isPlanKey("year")).toBe(false)
    expect(isPlanKey(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Kırmızıyı gör.**
  - Run: `cd apps/web && pnpm exec vitest run src/features/billing`
  - Expected: FAIL, modüller yok.

- [ ] **Step 3: Uygula.** `apps/web/src/features/billing/plans.ts`:

```ts
/**
 * Erişim dönemi paketleri (DOG-34). Tek seferlik; otomatik yenileme yok.
 * Ürün kimlikleri ve gösterim fiyatları yapılandırmada: fiyatlar K2'den sonra
 * Polar panelinde belirleniyor, ödeme sayfasındaki tutar Polar'dan geliyor.
 */
export type PlanKey = "week" | "month" | "quarter"

export const PLAN_DAYS: Record<PlanKey, number> = { week: 7, month: 30, quarter: 90 }

const ORDER: PlanKey[] = ["week", "month", "quarter"]
const PRODUCT_ENV: Record<PlanKey, string> = {
  week: "POLAR_PRODUCT_WEEK",
  month: "POLAR_PRODUCT_MONTH",
  quarter: "POLAR_PRODUCT_QUARTER",
}

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (ORDER as string[]).includes(value)
}

export interface PlanOffer {
  key: PlanKey
  days: number
  productId: string
  /** Paket ekranında gösterilen TL fiyat; ödeme sayfasındaki tutar Polar'dan. */
  priceTry: number | null
}

/** Ürün kimliği tanımlı paketler; `PLAN_PRICES_TRY` "week:149, month:349". */
export function plansFromEnv(env: Record<string, string | undefined>): PlanOffer[] {
  const prices = new Map(
    (env.PLAN_PRICES_TRY ?? "")
      .split(",")
      .map((pair) => pair.split(":").map((p) => p.trim()))
      .filter(([key, price]) => key && price && Number.isFinite(Number(price)))
      .map(([key, price]) => [key!, Number(price)]),
  )
  return ORDER.flatMap((key) => {
    const productId = env[PRODUCT_ENV[key]]?.trim()
    return productId ? [{ key, days: PLAN_DAYS[key], productId, priceTry: prices.get(key) ?? null }] : []
  })
}
```

`apps/web/src/features/billing/access.ts`:

```ts
import { PLAN_DAYS, type PlanKey } from "@/features/billing/plans"

/** Ücretsiz plan: ömür boyu bir uyarlama (spec §2). */
export const FREE_ADAPTATIONS = 1
/** Dönem içinde son 24 saatte en çok uyarlama; kötüye kullanım koruması. */
export const DAILY_CAP = 30

const DAY_MS = 864e5

export interface PassLike {
  status: "active" | "refunded"
  startsAt: Date
  endsAt: Date
}

function isLive(pass: PassLike, now: Date): boolean {
  return pass.status === "active" && pass.startsAt <= now && now < pass.endsAt
}

export type AdaptDecision =
  | { allowed: true; via: "free" | "pass" }
  | { allowed: false; reason: "payment_required" | "daily_cap" }

/**
 * Uyarlama hakkı. Dönem varsa dönem kullanılıyor (ücretsiz hak saklı kalır);
 * yoksa ücretsiz hak. Günlük tavan yalnızca dönemde: ücretsiz hak zaten bir.
 */
export function canAdapt(input: {
  adaptationsUsed: number
  adaptationsLast24h: number
  passes: PassLike[]
  now: Date
}): AdaptDecision {
  if (input.passes.some((p) => isLive(p, input.now))) {
    return input.adaptationsLast24h >= DAILY_CAP ? { allowed: false, reason: "daily_cap" } : { allowed: true, via: "pass" }
  }
  return input.adaptationsUsed < FREE_ADAPTATIONS ? { allowed: true, via: "free" } : { allowed: false, reason: "payment_required" }
}

/** Aktif dönemlerin en geç bitişi; yoksa null. Gelecekte başlayan (üst üste eklenmiş) dönem de sayılır. */
export function activePassEnd(passes: PassLike[], now: Date): Date | null {
  const ends = passes.filter((p) => p.status === "active" && now < p.endsAt).map((p) => p.endsAt.getTime())
  return ends.length ? new Date(Math.max(...ends)) : null
}

/** Yeni paketin aralığı: aktif dönem varsa en geç bitişin üstüne eklenir. */
export function extendPass(passes: PassLike[], plan: PlanKey, now: Date): { startsAt: Date; endsAt: Date } {
  const startsAt = activePassEnd(passes, now) ?? now
  return { startsAt, endsAt: new Date(startsAt.getTime() + PLAN_DAYS[plan] * DAY_MS) }
}
```

- [ ] **Step 4: Yeşili gör.**
  - Run: `cd apps/web && pnpm exec vitest run src/features/billing && pnpm exec tsc --noEmit`
  - Expected: PASS (access 10, plans 3), tsc temiz.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/features/billing/plans.ts apps/web/src/features/billing/access.ts apps/web/src/features/billing/plans.test.ts apps/web/src/features/billing/access.test.ts
git commit -m "Paketler ve saf yetki mantığı: ücretsiz hak, dönem, günlük tavan (DOG-34)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Sunucu tarafı hak hesabı ve ödeme olaylarının uygulanması

**Files:**
- Create: `apps/web/src/server/billing/provider.ts`, `apps/web/src/server/billing/entitlement.ts`
- Test: `apps/web/src/server/billing/entitlement.integration.test.ts`

**Interfaces:**
- Consumes: `canAdapt`, `extendPass`, `PassLike` (Task 2); `isPlanKey`, `PlanKey` (Task 2); `prisma.accessPass` (Task 1).
- Produces:
  - `provider.ts`:
    - `type BillingEvent = { type: "paid"; orderId: string; userId: string; plan: string } | { type: "refunded"; orderId: string }`
    - `interface BillingProvider { createCheckout(input: { userId: string; email: string; productId: string; plan: PlanKey; successUrl: string }): Promise<{ url: string }>; parseWebhook(rawBody: string, headers: Record<string, string>): Promise<BillingEvent | null> }`
    - `class WebhookSignatureError extends Error`
  - `entitlement.ts`:
    - `loadAccess(db, userId, now): Promise<{ adaptationsUsed: number; adaptationsLast24h: number; passes: PassLike[] }>`
    - `class PaymentRequiredError extends Error { code: "payment_required" | "daily_cap" }`
    - `assertCanAdapt(db, userId, now): Promise<void>`: izin yoksa `PaymentRequiredError` atar.
    - `applyBillingEvent(db, event, now): Promise<"granted" | "duplicate" | "revoked" | "ignored">`

- [ ] **Step 1: Sağlayıcı arayüzü.** `apps/web/src/server/billing/provider.ts`:

```ts
import type { PlanKey } from "@/features/billing/plans"

/**
 * Ödeme sağlayıcısının arayüzü (DOG-34). İlk uygulama Polar; şirket
 * kurulunca iyzico/PayTR, hacim büyüyünce Paddle yalnızca bunu uygular.
 * Dönemler bizim veritabanımızda; sağlayıcı yalnızca ödeme alıp haber verir.
 */
export type BillingEvent =
  | { type: "paid"; orderId: string; userId: string; plan: string }
  | { type: "refunded"; orderId: string }

export interface BillingProvider {
  createCheckout(input: {
    userId: string
    email: string
    productId: string
    plan: PlanKey
    successUrl: string
  }): Promise<{ url: string }>
  /** İmza geçersizse `WebhookSignatureError`; ilgilenmediğimiz olaysa null. */
  parseWebhook(rawBody: string, headers: Record<string, string>): Promise<BillingEvent | null>
}

export class WebhookSignatureError extends Error {
  constructor() {
    super("Geçersiz webhook imzası")
    this.name = "WebhookSignatureError"
  }
}
```

- [ ] **Step 2: Tümleşik testleri yaz.** `apps/web/src/server/billing/entitlement.integration.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest"
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import { PaymentRequiredError, applyBillingEvent, assertCanAdapt, loadAccess } from "@/server/billing/entitlement"

const toClean: string[] = []
const NOW = new Date("2026-11-10T12:00:00Z")
const day = 864e5

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function makeUser() {
  const u = await prisma.user.create({ data: { name: "Ödeme", email: `odeme-${Date.now()}-${Math.random()}@test.local` } })
  toClean.push(u.id)
  return u
}

/** Kullanıcıya bir analiz ve uyarlama; `createdAt` ve durum verilebilir. */
async function makeAdaptation(userId: string, createdAt: Date, status: "running" | "done" | "failed" = "done") {
  const resume = await prisma.resume.create({ data: { userId, filePath: "x", fileName: "cv.pdf" } as never })
  const posting = await prisma.jobPosting.create({ data: { userId, rawText: "ilan" } as never })
  const analysis = await prisma.analysis.create({
    data: { userId, resumeId: resume.id, jobPostingId: posting.id, status: "done", modelId: "m" } as never,
  })
  await prisma.adaptation.create({ data: { analysisId: analysis.id, draft: {}, modelId: "m", status, createdAt } })
}

describe("loadAccess", () => {
  it("counts non-failed adaptations and those in the last 24 hours", async () => {
    const u = await makeUser()
    await makeAdaptation(u.id, new Date(NOW.getTime() - 2 * day))
    await makeAdaptation(u.id, new Date(NOW.getTime() - 3600e3))
    await makeAdaptation(u.id, new Date(NOW.getTime() - 60e3), "failed")
    expect(await loadAccess(prisma, u.id, NOW)).toMatchObject({ adaptationsUsed: 2, adaptationsLast24h: 1, passes: [] })
  })
})

describe("assertCanAdapt", () => {
  it("lets the first adaptation through and stops the second without a pass", async () => {
    const u = await makeUser()
    await expect(assertCanAdapt(prisma, u.id, NOW)).resolves.toBeUndefined()
    await makeAdaptation(u.id, NOW)
    await expect(assertCanAdapt(prisma, u.id, NOW)).rejects.toMatchObject({ code: "payment_required" })
    await expect(assertCanAdapt(prisma, u.id, NOW)).rejects.toBeInstanceOf(PaymentRequiredError)
  })
})

describe("applyBillingEvent", () => {
  it("grants a pass once even if the same order arrives twice", async () => {
    // Review Focus 1.
    const u = await makeUser()
    const event = { type: "paid", orderId: `ord-${u.id}`, userId: u.id, plan: "month" } as const
    expect(await applyBillingEvent(prisma, event, NOW)).toBe("granted")
    expect(await applyBillingEvent(prisma, event, NOW)).toBe("duplicate")
    const passes = await prisma.accessPass.findMany({ where: { userId: u.id } })
    expect(passes).toHaveLength(1)
    expect(passes[0]!.endsAt).toEqual(new Date(NOW.getTime() + 30 * day))
    await expect(assertCanAdapt(prisma, u.id, NOW)).resolves.toBeUndefined()
  })

  it("stacks a second pass and a refund closes only its own order", async () => {
    // Review Focus 2.
    const u = await makeUser()
    await applyBillingEvent(prisma, { type: "paid", orderId: `a-${u.id}`, userId: u.id, plan: "week" }, NOW)
    await applyBillingEvent(prisma, { type: "paid", orderId: `b-${u.id}`, userId: u.id, plan: "week" }, NOW)
    const second = await prisma.accessPass.findUniqueOrThrow({ where: { providerOrderId: `b-${u.id}` } })
    expect(second.startsAt).toEqual(new Date(NOW.getTime() + 7 * day))
    expect(await applyBillingEvent(prisma, { type: "refunded", orderId: `a-${u.id}` }, NOW)).toBe("revoked")
    const statuses = (await prisma.accessPass.findMany({ where: { userId: u.id }, orderBy: { startsAt: "asc" } })).map((p) => p.status)
    expect(statuses).toEqual(["refunded", "active"])
  })

  it("ignores an unknown plan or a deleted user", async () => {
    // Review Focus 3.
    const u = await makeUser()
    expect(await applyBillingEvent(prisma, { type: "paid", orderId: `x-${u.id}`, userId: u.id, plan: "year" }, NOW)).toBe("ignored")
    expect(await applyBillingEvent(prisma, { type: "paid", orderId: `y-${u.id}`, userId: "silinmis-kullanici", plan: "month" }, NOW)).toBe(
      "ignored",
    )
    expect(await applyBillingEvent(prisma, { type: "refunded", orderId: "hic-olmayan" }, NOW)).toBe("ignored")
  })
})
```

`makeAdaptation`'daki `as never` dönüşümleri yalnızca testte, şemanın zorunlu alanlarını kısaltmak için. Çalıştırınca Prisma eksik zorunlu alan derse (örneğin `Resume.label`, `JobPosting.position`), o alanları şemaya bakıp aynı nesneye ekle.

- [ ] **Step 3: Kırmızıyı gör.**
  - Run: `cd apps/web && S3_BUCKET= pnpm exec dotenv -e ../../.env -- sh -c 'S3_BUCKET= vitest run --config vitest.integration.config.ts src/server/billing/entitlement.integration.test.ts'`
  - Expected: FAIL, `@/server/billing/entitlement` yok.

- [ ] **Step 4: Uygula.** `apps/web/src/server/billing/entitlement.ts`:

```ts
import type { prisma } from "@uyarla/db"
import { canAdapt, extendPass, type PassLike } from "@/features/billing/access"
import { isPlanKey } from "@/features/billing/plans"
import type { BillingEvent } from "@/server/billing/provider"

type Db = typeof prisma
const DAY_MS = 864e5

/**
 * Kullanıcının uyarlama hakkı için gereken sayılar (DOG-34).
 *
 * Ücretsiz hak ayrı bir sayaç değil: başarısız olmayan uyarlamalar sayılıyor.
 * Aynı analizin uyarlamasını yeniden açmak yeni kayıt açmadığı için hak
 * harcamıyor (api/adapt mevcut kaydı döndürüyor).
 */
export async function loadAccess(
  db: Db,
  userId: string,
  now: Date,
): Promise<{ adaptationsUsed: number; adaptationsLast24h: number; passes: PassLike[] }> {
  const mine = { analysis: { userId }, status: { not: "failed" as const } }
  const [adaptationsUsed, adaptationsLast24h, passes] = await Promise.all([
    db.adaptation.count({ where: mine }),
    db.adaptation.count({ where: { ...mine, createdAt: { gt: new Date(now.getTime() - DAY_MS) } } }),
    db.accessPass.findMany({ where: { userId }, select: { status: true, startsAt: true, endsAt: true } }),
  ])
  return { adaptationsUsed, adaptationsLast24h, passes }
}

export class PaymentRequiredError extends Error {
  constructor(readonly code: "payment_required" | "daily_cap") {
    super(
      code === "daily_cap"
        ? "Bugünlük uyarlama sınırına ulaştın. Yarın devam edebilirsin."
        : "Ücretsiz uyarlama hakkını kullandın. Devam etmek için bir paket seç.",
    )
    this.name = "PaymentRequiredError"
  }
}

export async function assertCanAdapt(db: Db, userId: string, now: Date): Promise<void> {
  const decision = canAdapt({ ...(await loadAccess(db, userId, now)), now })
  if (!decision.allowed) throw new PaymentRequiredError(decision.reason)
}

/**
 * Sağlayıcı olayını uygular. Sipariş kimliği tekil: aynı bildirim ikinci kez
 * gelirse "duplicate" (Polar 2xx almazsa yeniden deniyor). Bilinmeyen paket ya
 * da silinmiş kullanıcı "ignored": dönem açılmıyor ama istek başarılı sayılıyor,
 * yoksa sağlayıcı sonsuza dek dener. İade yalnızca kendi siparişini kapatıyor.
 */
export async function applyBillingEvent(
  db: Db,
  event: BillingEvent,
  now: Date,
): Promise<"granted" | "duplicate" | "revoked" | "ignored"> {
  if (event.type === "refunded") {
    const { count } = await db.accessPass.updateMany({
      where: { providerOrderId: event.orderId, status: "active" },
      data: { status: "refunded" },
    })
    return count > 0 ? "revoked" : "ignored"
  }

  if (!isPlanKey(event.plan)) return "ignored"
  if (await db.accessPass.findUnique({ where: { providerOrderId: event.orderId } })) return "duplicate"
  const user = await db.user.findUnique({ where: { id: event.userId }, select: { id: true } })
  if (!user) return "ignored"

  const passes = await db.accessPass.findMany({ where: { userId: user.id }, select: { status: true, startsAt: true, endsAt: true } })
  const range = extendPass(passes, event.plan, now)
  try {
    await db.accessPass.create({
      data: { userId: user.id, plan: event.plan, providerOrderId: event.orderId, ...range },
    })
  } catch (error) {
    // Aynı anda gelen iki bildirim: tekil kısıt ikincisini durduruyor.
    if ((error as { code?: string }).code === "P2002") return "duplicate"
    throw error
  }
  return "granted"
}
```

- [ ] **Step 5: Yeşili gör.**
  - Run: Step 3'teki komut, ardından `pnpm exec tsc --noEmit`.
  - Expected: PASS (5 test), tsc temiz.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/server/billing/provider.ts apps/web/src/server/billing/entitlement.ts apps/web/src/server/billing/entitlement.integration.test.ts
git commit -m "Hak hesabı ve ödeme olaylarının uygulanması: tekil sipariş, üst üste dönem, iade (DOG-34)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Uyarlama ucunda ödeme duvarı ve istemcide yönlendirme

**Files:**
- Modify: `apps/web/src/app/api/adapt/route.ts`
- Create: `apps/web/src/features/billing/paywall.ts`, `apps/web/src/features/billing/paywall.test.ts`
- Modify: `apps/web/src/features/analysis/components/AnalyzeView.tsx` (`adapt` fonksiyonu)
- Modify: `apps/web/src/features/applications/components/ApplicationBoard.tsx` (kartın `adapt` fonksiyonu)

**Interfaces:**
- Consumes: `assertCanAdapt`, `PaymentRequiredError` (Task 3).
- Produces: `plansPath(returnTo: string): string` → `/plans?donus=<encoded>`; yalnızca `/` ile başlayan iç adresler kabul (`//` ve `http` değil), aksi hâlde `/plans`.

- [ ] **Step 1: Testi yaz.** `apps/web/src/features/billing/paywall.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { plansPath } from "@/features/billing/paywall"

describe("plansPath", () => {
  it("carries the page to return to after payment", () => {
    expect(plansPath("/analyze?uyarla=abc")).toBe("/plans?donus=%2Fanalyze%3Fuyarla%3Dabc")
  })

  it("drops a return address that leaves the site", () => {
    expect(plansPath("https://kotu.example")).toBe("/plans")
    expect(plansPath("//kotu.example")).toBe("/plans")
  })
})
```

- [ ] **Step 2: Kırmızı.**
  - Run: `cd apps/web && pnpm exec vitest run src/features/billing/paywall.test.ts`
  - Expected: FAIL, modül yok.

- [ ] **Step 3: Uygula.** `apps/web/src/features/billing/paywall.ts`:

```ts
/** Paket ekranı; ödemeden sonra kullanıcı `donus` adresine dönüyor (DOG-34). */
export function plansPath(returnTo: string): string {
  const internal = returnTo.startsWith("/") && !returnTo.startsWith("//")
  return internal ? `/plans?donus=${encodeURIComponent(returnTo)}` : "/plans"
}
```

`apps/web/src/app/api/adapt/route.ts` içinde:
  - Import: `import { PaymentRequiredError, assertCanAdapt } from "@/server/billing/entitlement"`.
  - `const existing = …; if (existing) return …` satırından **sonra**, `prisma.adaptation.create`'ten **önce** ekle:

```ts
    // Ödeme duvarı (DOG-34): ilk uyarlama ücretsiz, sonrası dönem ister.
    // Mevcut uyarlamayı yeniden açmak yukarıda döndü; hak harcamıyor.
    await assertCanAdapt(prisma, session.user.id, new Date())
```

  - `catch` bloğunda `authErrorResponse` kontrolünden sonra ekle:

```ts
    if (error instanceof PaymentRequiredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 402 })
    }
```

`AnalyzeView.tsx` `adapt` fonksiyonunda `registration_required` kontrolünün altına ekle (import `plansPath` from `@/features/billing/paywall`):

```ts
    // Ücretsiz hak bitti (DOG-34): paket ekranına, ödemeden sonra uyarlamaya dönüş.
    if (parsed.code === "payment_required") {
      router.push(plansPath(`/analyze?uyarla=${encodeURIComponent(analysisId)}`))
      return
    }
```

`ApplicationBoard.tsx` kartının `adapt` fonksiyonunu şöyle değiştir (import `apiErrorBody` from `@/lib/api`, `plansPath` from `@/features/billing/paywall`):

```ts
  async function adapt() {
    setAdapting(true)
    try {
      const { adaptationId } = await startAdaptation(card.analysisId)
      router.push(`/adapt/${adaptationId}`)
    } catch (error) {
      // Ücretsiz hak bitti (DOG-34): paket ekranına, dönüşte uyarlama başlıyor.
      if ((await apiErrorBody(error)).code === "payment_required") {
        router.push(plansPath(`/analyze?uyarla=${encodeURIComponent(card.analysisId)}`))
        return
      }
      setAdapting(false)
    }
  }
```

- [ ] **Step 4: Yeşil.**
  - Run: `cd apps/web && pnpm exec vitest run && pnpm exec tsc --noEmit`
  - Expected: PASS, tsc temiz.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/app/api/adapt/route.ts apps/web/src/features/billing/paywall.ts apps/web/src/features/billing/paywall.test.ts apps/web/src/features/analysis/components/AnalyzeView.tsx apps/web/src/features/applications/components/ApplicationBoard.tsx
git commit -m "Uyarlama ucunda ödeme duvarı (402) ve paket ekranına yönlendirme (DOG-34)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Polar sağlayıcısı

**Files:**
- Modify: `apps/web/package.json` (`@polar-sh/sdk@1.0.2`)
- Create: `apps/web/src/server/billing/polar.ts`
- Test: `apps/web/src/server/billing/polar.test.ts`

**Interfaces:**
- Consumes: `BillingProvider`, `BillingEvent`, `WebhookSignatureError` (Task 3).
- Produces:
  - `interface PolarDeps { createCheckout(body: { products: string[]; external_customer_id: string; customer_email: string; success_url: string; metadata: Record<string, string>; locale: string }): Promise<{ url: string }>; validateEvent(body: string, headers: Record<string, string>, secret: string): Promise<{ type: string; data: unknown }>; isVerificationError(error: unknown): boolean }`
  - `createPolarProvider(config: { webhookSecret: string }, deps: PolarDeps): BillingProvider`
  - `polarProviderFromEnv(env): BillingProvider`: gerçek SDK ile.

- [ ] **Step 1: Bağımlılık.**
  - Run: `cd apps/web && pnpm add @polar-sh/sdk@1.0.2`
  - Expected: `package.json`'a `"@polar-sh/sdk": "1.0.2"` eklenir.

- [ ] **Step 2: Testi yaz.** `apps/web/src/server/billing/polar.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"
import { createPolarProvider, type PolarDeps } from "@/server/billing/polar"
import { WebhookSignatureError } from "@/server/billing/provider"

class FakeVerificationError extends Error {}

const deps = (overrides: Partial<PolarDeps> = {}): PolarDeps => ({
  createCheckout: vi.fn().mockResolvedValue({ url: "https://sandbox.polar.sh/checkout/abc" }),
  validateEvent: vi.fn(),
  isVerificationError: (e) => e instanceof FakeVerificationError,
  ...overrides,
})

const order = (overrides: Record<string, unknown> = {}) => ({
  id: "ord_1",
  metadata: { plan: "month" },
  customer: { external_id: "user_1", email: "a@b.c" },
  ...overrides,
})

describe("polar provider", () => {
  it("opens a Turkish checkout carrying the user and the plan", async () => {
    const d = deps()
    const result = await createPolarProvider({ webhookSecret: "whsec_x" }, d).createCheckout({
      userId: "user_1",
      email: "a@b.c",
      productId: "prod_m",
      plan: "month",
      successUrl: "https://uyarla.com.tr/plans/tesekkurler",
    })
    expect(result.url).toBe("https://sandbox.polar.sh/checkout/abc")
    expect(d.createCheckout).toHaveBeenCalledWith({
      products: ["prod_m"],
      external_customer_id: "user_1",
      customer_email: "a@b.c",
      success_url: "https://uyarla.com.tr/plans/tesekkurler",
      metadata: { plan: "month" },
      locale: "tr",
    })
  })

  it("turns order.paid into a paid event", async () => {
    const d = deps({ validateEvent: vi.fn().mockResolvedValue({ type: "order.paid", data: order() }) })
    expect(await createPolarProvider({ webhookSecret: "s" }, d).parseWebhook("{}", {})).toEqual({
      type: "paid",
      orderId: "ord_1",
      userId: "user_1",
      plan: "month",
    })
  })

  it("turns order.refunded into a refund", async () => {
    const d = deps({ validateEvent: vi.fn().mockResolvedValue({ type: "order.refunded", data: order() }) })
    expect(await createPolarProvider({ webhookSecret: "s" }, d).parseWebhook("{}", {})).toEqual({ type: "refunded", orderId: "ord_1" })
  })

  it("ignores events we do not use and orders without our user", async () => {
    const other = deps({ validateEvent: vi.fn().mockResolvedValue({ type: "checkout.created", data: {} }) })
    expect(await createPolarProvider({ webhookSecret: "s" }, other).parseWebhook("{}", {})).toBeNull()
    const noUser = deps({
      validateEvent: vi.fn().mockResolvedValue({ type: "order.paid", data: order({ customer: { external_id: null } }) }),
    })
    expect(await createPolarProvider({ webhookSecret: "s" }, noUser).parseWebhook("{}", {})).toBeNull()
  })

  it("reports a bad signature as WebhookSignatureError", async () => {
    const d = deps({ validateEvent: vi.fn().mockRejectedValue(new FakeVerificationError("bad")) })
    await expect(createPolarProvider({ webhookSecret: "s" }, d).parseWebhook("{}", {})).rejects.toBeInstanceOf(WebhookSignatureError)
  })
})
```

- [ ] **Step 3: Kırmızı.**
  - Run: `cd apps/web && pnpm exec vitest run src/server/billing/polar.test.ts`
  - Expected: FAIL, modül yok.

- [ ] **Step 4: Uygula.** `apps/web/src/server/billing/polar.ts`:

```ts
import { createPolar, webhooks } from "@polar-sh/sdk/2026-10"
import type { BillingEvent, BillingProvider } from "@/server/billing/provider"
import { WebhookSignatureError } from "@/server/billing/provider"

/**
 * Polar (DOG-34). Merchant of record: vergiyi ve faturayı Polar üstleniyor,
 * kart bilgisi uyarla'ya hiç gelmiyor. Kullanıcı kimliği ödeme oturumunda
 * `external_customer_id`, paket `metadata.plan` olarak gidiyor ve siparişle
 * geri dönüyor.
 *
 * SDK çağrıları `PolarDeps` arkasında: testte sahte, üretimde gerçek SDK.
 */
export interface PolarDeps {
  createCheckout(body: {
    products: string[]
    external_customer_id: string
    customer_email: string
    success_url: string
    metadata: Record<string, string>
    locale: string
  }): Promise<{ url: string }>
  validateEvent(body: string, headers: Record<string, string>, secret: string): Promise<{ type: string; data: unknown }>
  isVerificationError(error: unknown): boolean
}

interface OrderData {
  id?: unknown
  metadata?: Record<string, unknown> | null
  customer?: { external_id?: unknown } | null
}

export function createPolarProvider(config: { webhookSecret: string }, deps: PolarDeps): BillingProvider {
  return {
    async createCheckout({ userId, email, productId, plan, successUrl }) {
      const checkout = await deps.createCheckout({
        products: [productId],
        external_customer_id: userId,
        customer_email: email,
        success_url: successUrl,
        metadata: { plan },
        locale: "tr",
      })
      return { url: checkout.url }
    },

    async parseWebhook(rawBody, headers): Promise<BillingEvent | null> {
      let event: { type: string; data: unknown }
      try {
        event = await deps.validateEvent(rawBody, headers, config.webhookSecret)
      } catch (error) {
        if (deps.isVerificationError(error)) throw new WebhookSignatureError()
        throw error
      }
      if (event.type !== "order.paid" && event.type !== "order.refunded") return null
      const order = event.data as OrderData
      if (typeof order.id !== "string") return null
      if (event.type === "order.refunded") return { type: "refunded", orderId: order.id }
      const userId = order.customer?.external_id
      const plan = order.metadata?.plan
      if (typeof userId !== "string" || !userId || typeof plan !== "string") return null
      return { type: "paid", orderId: order.id, userId, plan }
    },
  }
}

/** Gerçek SDK ile. `POLAR_SERVER` öntanımlı sandbox: üretime geçiş açık bir karar. */
export function polarProviderFromEnv(env: Record<string, string | undefined> = process.env): BillingProvider {
  const accessToken = env.POLAR_ACCESS_TOKEN
  const webhookSecret = env.POLAR_WEBHOOK_SECRET
  if (!accessToken || !webhookSecret) throw new Error("POLAR_ACCESS_TOKEN ve POLAR_WEBHOOK_SECRET gerekli")
  const polar = createPolar({ accessToken, environment: env.POLAR_SERVER === "production" ? "production" : "sandbox" })
  return createPolarProvider(
    { webhookSecret },
    {
      createCheckout: (body) => polar.checkouts.create(body),
      validateEvent: (body, headers, secret) => webhooks.validateEvent(body, headers, secret),
      isVerificationError: (error) => error instanceof webhooks.PolarWebhookVerificationError,
    },
  )
}
```

- [ ] **Step 5: Yeşil.**
  - Run: `cd apps/web && pnpm exec vitest run src/server/billing/polar.test.ts && pnpm exec tsc --noEmit`
  - Expected: PASS (5 test). tsc temiz. `createPolar` seçenek adı (`environment`) ya da `checkouts.create` gövde tipi tsc'de uyuşmazsa SDK'nın `dist/2026-10/index.d.mts` tanımına göre düzelt; davranış değişmez.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/server/billing/polar.ts apps/web/src/server/billing/polar.test.ts
git commit -m "Polar sağlayıcısı: Türkçe ödeme oturumu, sipariş bildirimi, imza doğrulama (DOG-34)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Ödeme uçları (`/api/billing/[action]`)

**Files:**
- Create: `apps/web/src/server/billing/handlers.ts`
- Create: `apps/web/src/app/api/billing/[action]/route.ts`
- Test: `apps/web/src/server/billing/handlers.integration.test.ts`

**Interfaces:**
- Consumes: `BillingProvider`, `WebhookSignatureError` (Task 3); `applyBillingEvent`, `loadAccess` (Task 3); `plansFromEnv`, `isPlanKey` (Task 2); `activePassEnd`, `FREE_ADAPTATIONS` (Task 2); `getSession`, `ensureRegistered`, `authErrorResponse` (`@/server/authz`); `siteUrl()` (`@/lib/site`).
- Produces:
  - `handleCheckout(input: { db; provider; plans: PlanOffer[]; userId: string; body: unknown; baseUrl: string }): Promise<{ status: number; json: unknown }>`
  - `handleWebhook(input: { db; provider; rawBody: string; headers: Record<string, string>; now: Date; log?: (msg: string, extra: unknown) => void }): Promise<{ status: number; json: unknown }>`
  - `handleStatus(input: { db; userId: string; now: Date }): Promise<{ passEndsAt: string | null; freeUsed: boolean }>`
  - HTTP:
    - `POST /api/billing/checkout` `{ plan, returnTo }` → `{ url }`
    - `POST /api/billing/webhook` → 200 / 403
    - `GET /api/billing/status` → `{ passEndsAt, freeUsed }`

- [ ] **Step 1: Testleri yaz.** `apps/web/src/server/billing/handlers.integration.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import { handleCheckout, handleStatus, handleWebhook } from "@/server/billing/handlers"
import { WebhookSignatureError, type BillingEvent, type BillingProvider } from "@/server/billing/provider"

const toClean: string[] = []
const NOW = new Date("2026-11-10T12:00:00Z")
afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})
async function makeUser() {
  const u = await prisma.user.create({ data: { name: "Uç", email: `uc-${Date.now()}-${Math.random()}@test.local` } })
  toClean.push(u.id)
  return u
}
const PLANS = [{ key: "month" as const, days: 30, productId: "prod_m", priceTry: 349 }]
const provider = (event: BillingEvent | null | Error): BillingProvider => ({
  createCheckout: vi.fn().mockResolvedValue({ url: "https://sandbox.polar.sh/c/1" }),
  parseWebhook: event instanceof Error ? vi.fn().mockRejectedValue(event) : vi.fn().mockResolvedValue(event),
})

describe("handleCheckout", () => {
  it("returns the provider's checkout address with a thanks page that returns to the user's place", async () => {
    const u = await makeUser()
    const p = provider(null)
    const res = await handleCheckout({
      db: prisma,
      provider: p,
      plans: PLANS,
      userId: u.id,
      body: { plan: "month", returnTo: "/analyze?uyarla=a1" },
      baseUrl: "https://uyarla.com.tr",
    })
    expect(res).toEqual({ status: 200, json: { url: "https://sandbox.polar.sh/c/1" } })
    expect(p.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod_m",
        plan: "month",
        successUrl: "https://uyarla.com.tr/plans/tesekkurler?donus=%2Fanalyze%3Fuyarla%3Da1",
      }),
    )
  })

  it("rejects a plan that is not offered", async () => {
    const u = await makeUser()
    const res = await handleCheckout({ db: prisma, provider: provider(null), plans: PLANS, userId: u.id, body: { plan: "week" }, baseUrl: "x" })
    expect(res.status).toBe(400)
  })
})

describe("handleWebhook", () => {
  it("answers 403 to a bad signature and writes nothing", async () => {
    const res = await handleWebhook({ db: prisma, provider: provider(new WebhookSignatureError()), rawBody: "{}", headers: {}, now: NOW })
    expect(res.status).toBe(403)
  })

  it("grants once and answers 200 to a repeated delivery", async () => {
    // Review Focus 1.
    const u = await makeUser()
    const p = provider({ type: "paid", orderId: `w-${u.id}`, userId: u.id, plan: "month" })
    expect((await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW })).status).toBe(200)
    expect((await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW })).status).toBe(200)
    expect(await prisma.accessPass.count({ where: { userId: u.id } })).toBe(1)
  })

  it("answers 200 but logs when the order cannot be applied", async () => {
    // Review Focus 3: Polar sonsuza dek denemesin, biz de fark edelim.
    const log = vi.fn()
    const p = provider({ type: "paid", orderId: "kayip", userId: "silinmis", plan: "month" })
    const res = await handleWebhook({ db: prisma, provider: p, rawBody: "{}", headers: {}, now: NOW, log })
    expect(res.status).toBe(200)
    expect(log).toHaveBeenCalled()
  })
})

describe("handleStatus", () => {
  it("reports the pass end and whether the free adaptation was used", async () => {
    const u = await makeUser()
    expect(await handleStatus({ db: prisma, userId: u.id, now: NOW })).toEqual({ passEndsAt: null, freeUsed: false })
    await prisma.accessPass.create({
      data: { userId: u.id, plan: "week", providerOrderId: `s-${u.id}`, startsAt: NOW, endsAt: new Date(NOW.getTime() + 7 * 864e5) },
    })
    expect((await handleStatus({ db: prisma, userId: u.id, now: NOW })).passEndsAt).toBe(new Date(NOW.getTime() + 7 * 864e5).toISOString())
  })
})
```

- [ ] **Step 2: Kırmızı.**
  - Run: `cd apps/web && S3_BUCKET= pnpm exec dotenv -e ../../.env -- sh -c 'S3_BUCKET= vitest run --config vitest.integration.config.ts src/server/billing/handlers.integration.test.ts'`
  - Expected: FAIL, modül yok.

- [ ] **Step 3: Uygula.** `apps/web/src/server/billing/handlers.ts`:

```ts
import type { prisma } from "@uyarla/db"
import { FREE_ADAPTATIONS, activePassEnd } from "@/features/billing/access"
import { isPlanKey, type PlanOffer } from "@/features/billing/plans"
import { plansPath } from "@/features/billing/paywall"
import { applyBillingEvent, loadAccess } from "@/server/billing/entitlement"
import { WebhookSignatureError, type BillingProvider } from "@/server/billing/provider"

type Db = typeof prisma
type Reply = { status: number; json: unknown }

/** Ödeme oturumu: paket listede olmalı; teşekkür sayfası `donus`u taşıyor. */
export async function handleCheckout(input: {
  db: Db
  provider: BillingProvider
  plans: PlanOffer[]
  userId: string
  body: unknown
  baseUrl: string
}): Promise<Reply> {
  const body = (input.body ?? {}) as { plan?: unknown; returnTo?: unknown }
  const offer = isPlanKey(body.plan) ? input.plans.find((p) => p.key === body.plan) : undefined
  if (!offer) return { status: 400, json: { error: "Bu paket şu an sunulmuyor.", code: "unknown_plan" } }
  const user = await input.db.user.findUniqueOrThrow({ where: { id: input.userId }, select: { email: true } })
  const back = typeof body.returnTo === "string" ? plansPath(body.returnTo).replace(/^\/plans/, "") : ""
  const { url } = await input.provider.createCheckout({
    userId: input.userId,
    email: user.email,
    productId: offer.productId,
    plan: offer.key,
    successUrl: `${input.baseUrl}/plans/tesekkurler${back}`,
  })
  return { status: 200, json: { url } }
}

/**
 * Sağlayıcı bildirimi. İmza geçersizse 403. Uygulanamayan olay (bilinmeyen
 * paket, silinmiş kullanıcı) da 200: sağlayıcı yeniden denemesin; loglanıyor.
 */
export async function handleWebhook(input: {
  db: Db
  provider: BillingProvider
  rawBody: string
  headers: Record<string, string>
  now: Date
  log?: (message: string, extra: unknown) => void
}): Promise<Reply> {
  const log = input.log ?? ((message, extra) => console.warn(message, extra))
  let event
  try {
    event = await input.provider.parseWebhook(input.rawBody, input.headers)
  } catch (error) {
    if (error instanceof WebhookSignatureError) return { status: 403, json: { error: "invalid_signature" } }
    throw error
  }
  if (!event) return { status: 200, json: { received: true } }
  const outcome = await applyBillingEvent(input.db, event, input.now)
  if (outcome === "ignored") log("[billing] uygulanamayan ödeme olayı", event)
  return { status: 200, json: { received: true, outcome } }
}

export async function handleStatus(input: { db: Db; userId: string; now: Date }): Promise<{ passEndsAt: string | null; freeUsed: boolean }> {
  const access = await loadAccess(input.db, input.userId, input.now)
  return {
    passEndsAt: activePassEnd(access.passes, input.now)?.toISOString() ?? null,
    freeUsed: access.adaptationsUsed >= FREE_ADAPTATIONS,
  }
}
```

`apps/web/src/app/api/billing/[action]/route.ts`:

```ts
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { plansFromEnv } from "@/features/billing/plans"
import { siteUrl } from "@/lib/site"
import { authErrorResponse, ensureRegistered, getSession } from "@/server/authz"
import { handleCheckout, handleStatus, handleWebhook } from "@/server/billing/handlers"
import { polarProviderFromEnv } from "@/server/billing/polar"

export const runtime = "nodejs"

/**
 * Ödeme uçları tek dosyada (DOG-34): Vercel Hobby 12 fonksiyon sınırının
 * kenarındayız; ayrı dosyalar ayrı fonksiyon demek.
 *   POST /api/billing/checkout   ödeme oturumu
 *   POST /api/billing/webhook    Polar bildirimi (oturum yok, imza var)
 *   GET  /api/billing/status     dönem ve ücretsiz hak
 */
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  try {
    if (action === "webhook") {
      const rawBody = await request.text()
      const headers = Object.fromEntries(request.headers.entries())
      const reply = await handleWebhook({ db: prisma, provider: polarProviderFromEnv(), rawBody, headers, now: new Date() })
      return NextResponse.json(reply.json, { status: reply.status })
    }
    if (action === "checkout") {
      // Review Focus 4: anonim kullanıcı 401 registration_required.
      const session = ensureRegistered(await getSession())
      const reply = await handleCheckout({
        db: prisma,
        provider: polarProviderFromEnv(),
        plans: plansFromEnv(process.env),
        userId: session.user.id,
        body: await request.json().catch(() => ({})),
        baseUrl: siteUrl(),
      })
      return NextResponse.json(reply.json, { status: reply.status })
    }
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    console.error("[api/billing]", action, error)
    return NextResponse.json({ error: "Ödeme sayfasını açamadık. Birazdan tekrar dener misin?", code: "unknown" }, { status: 500 })
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  if (action !== "status") return NextResponse.json({ error: "not_found" }, { status: 404 })
  try {
    const session = ensureRegistered(await getSession())
    return NextResponse.json(await handleStatus({ db: prisma, userId: session.user.id, now: new Date() }))
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    throw error
  }
}
```

- [ ] **Step 4: Anonim kullanıcı kontrolü (Review Focus 4).** `ensureRegistered`'in anonim oturuma `registration_required` attığını mevcut `authz.integration.test.ts` doğruluyor. Route'un bunu kullandığını `grep -n "ensureRegistered" src/app/api/billing/\[action\]/route.ts` ile kontrol et.
  - Expected: checkout dalında bir eşleşme.

- [ ] **Step 5: Yeşil ve derleme.**
  - Run: Step 2 komutu, ardından `cd apps/web && pnpm exec tsc --noEmit && pnpm exec dotenv -e ../../.env -- next build 2>&1 | tail -30`
  - Expected: testler PASS (6), tsc temiz, build başarılı. Build çıktısında `/api/billing/[action]` görünür. Sonra `rm -rf .next`: geliştirme sunucusu aynı klasörü kullanıyor.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/server/billing/handlers.ts apps/web/src/server/billing/handlers.integration.test.ts "apps/web/src/app/api/billing/[action]/route.ts"
git commit -m "Ödeme uçları: checkout, webhook, durum; tek route dosyası (DOG-34)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Arayüz: paket ekranı, teşekkür sayfası, Hesabım'da dönem

**Files:**
- Create: `apps/web/src/features/billing/api.ts`
- Create: `apps/web/src/features/billing/components/PlansView.tsx`, `ThanksView.tsx`, `PassSection.tsx`
- Create: `apps/web/src/app/(app)/(focused)/plans/page.tsx`, `apps/web/src/app/(app)/(focused)/plans/tesekkurler/page.tsx`
- Modify: `apps/web/src/features/account/components/AccountView.tsx` (`PassSection` eklenir)
- Test: `apps/web/src/features/billing/format.test.ts` (saf biçimlendirme)

**Interfaces:**
- Consumes: `POST /api/billing/checkout`, `GET /api/billing/status` (Task 6); `plansFromEnv`, `PlanOffer` (Task 2).
- Produces:
  - `createCheckout(plan: PlanKey, returnTo: string | null): Promise<{ url: string }>`
  - `useBillingStatus(options?: { pollMs?: number })`
  - `formatPassEnd(iso: string): string` → "10 Aralık 2026"
  - `PLAN_LABEL: Record<PlanKey, string>`

- [ ] **Step 1: Biçimlendirme testleri.** `apps/web/src/features/billing/format.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { PLAN_LABEL, formatPassEnd, perDay } from "@/features/billing/format"

describe("billing format", () => {
  it("names the plans in Turkish", () => {
    expect(PLAN_LABEL).toEqual({ week: "1 hafta", month: "1 ay", quarter: "3 ay" })
  })

  it("formats the pass end as a Turkish date", () => {
    expect(formatPassEnd("2026-12-10T12:00:00.000Z")).toBe("10 Aralık 2026")
  })

  it("shows the price per day for comparison", () => {
    expect(perDay(349, 30)).toBe("11,63 TL/gün")
    expect(perDay(null, 30)).toBeNull()
  })
})
```

- [ ] **Step 2: Kırmızı.**
  - Run: `cd apps/web && pnpm exec vitest run src/features/billing/format.test.ts`
  - Expected: FAIL.

- [ ] **Step 3: Uygula.** `apps/web/src/features/billing/format.ts`:

```ts
import type { PlanKey } from "@/features/billing/plans"

export const PLAN_LABEL: Record<PlanKey, string> = { week: "1 hafta", month: "1 ay", quarter: "3 ay" }

export function formatPassEnd(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(
    new Date(iso),
  )
}

/** Paketleri karşılaştırmak için günlük fiyat; fiyat yoksa null. */
export function perDay(priceTry: number | null, days: number): string | null {
  if (priceTry === null) return null
  return `${(priceTry / days).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL/gün`
}
```

`apps/web/src/features/billing/api.ts`:

```ts
import { useQuery } from "@tanstack/react-query"
import type { PlanKey } from "@/features/billing/plans"
import { api } from "@/lib/api"

export async function createCheckout(plan: PlanKey, returnTo: string | null): Promise<{ url: string }> {
  return (await api.post<{ url: string }>("/billing/checkout", { plan, returnTo })).data
}

export interface BillingStatus {
  passEndsAt: string | null
  freeUsed: boolean
}

export const billingStatusKey = ["billing-status"] as const

/** Dönem durumu; teşekkür sayfası dönem açılana kadar yokluyor. */
export function useBillingStatus(options: { pollMs?: number; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: billingStatusKey,
    queryFn: async () => (await api.get<BillingStatus>("/billing/status")).data,
    enabled: options.enabled ?? true,
    refetchInterval: (query) => (options.pollMs && !query.state.data?.passEndsAt ? options.pollMs : false),
  })
}
```

`apps/web/src/features/billing/components/PlansView.tsx`:

```tsx
"use client"

import { useState } from "react"
import { createCheckout, useBillingStatus } from "@/features/billing/api"
import { PLAN_LABEL, formatPassEnd, perDay } from "@/features/billing/format"
import type { PlanOffer } from "@/features/billing/plans"
import { apiErrorMessage } from "@/lib/api"

/**
 * Paket ekranı (DOG-34). Ödeme Polar'ın sayfasında; buradan oraya gidiliyor.
 * Cayma hakkı onayı ödeme öncesi zorunlu (Mesafeli Sözleşmeler Yönetmeliği md. 15).
 */
export function PlansView({ plans, returnTo }: { plans: PlanOffer[]; returnTo: string | null }) {
  const status = useBillingStatus()
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const best = plans.reduce<PlanOffer | null>(
    (b, p) => (p.priceTry !== null && (!b || (b.priceTry ?? Infinity) / b.days > p.priceTry / p.days) ? p : b),
    null,
  )

  async function buy(plan: PlanOffer) {
    setError(null)
    setBusy(plan.key)
    try {
      const { url } = await createCheckout(plan.key, returnTo)
      window.location.href = url
    } catch (e) {
      setError(await apiErrorMessage(e, "Ödeme sayfasını açamadık. Birazdan tekrar dener misin?"))
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl sm:text-3xl">Uyarlamaya devam et</h1>
      <p className="mt-2 text-muted">
        {status.data?.passEndsAt
          ? `Erişimin ${formatPassEnd(status.data.passEndsAt)} tarihine kadar açık. Yeni paket bu tarihin üstüne eklenir.`
          : "Ücretsiz uyarlama hakkını kullandın. Bir erişim dönemi seç; süre boyunca istediğin kadar CV uyarla ve ön yazı oluştur. Otomatik yenileme yok."}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.key} className="rounded-card border border-border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold text-muted">{PLAN_LABEL[plan.key]}</p>
            <p className="mt-1 text-3xl font-bold">{plan.priceTry !== null ? `${plan.priceTry} TL` : "—"}</p>
            <p className="text-xs text-muted">{perDay(plan.priceTry, plan.days)}</p>
            {best?.key === plan.key && <p className="mt-2 text-xs font-semibold text-brand-green">En iyi birim fiyat</p>}
            <button
              type="button"
              className="mt-4 w-full rounded-button bg-brand-blue px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              disabled={!consent || busy !== null}
              onClick={() => void buy(plan)}
            >
              {busy === plan.key ? "Yönlendiriliyor…" : "Öde"}
            </button>
          </div>
        ))}
      </div>

      <label className="mt-6 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>
          Erişimin hemen başlamasını ve bu nedenle cayma hakkımı kaybedeceğimi kabul ediyorum.{" "}
          <a href="/refund" target="_blank" rel="noreferrer">
            İade ve cayma koşulları
          </a>
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-red">
          {error}
        </p>
      )}
      <p className="mt-4 text-xs text-muted">
        Ödeme Polar üzerinden alınır; kart bilgin uyarla&apos;ya gelmez. Faturan e-postana gönderilir.
      </p>
    </div>
  )
}
```

`apps/web/src/features/billing/components/ThanksView.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useBillingStatus } from "@/features/billing/api"
import { formatPassEnd } from "@/features/billing/format"

/** Ödemeden sonra: bildirim birkaç saniye gecikebilir; dönem açılınca kullanıcı işine dönüyor. */
export function ThanksView({ returnTo }: { returnTo: string | null }) {
  const router = useRouter()
  const status = useBillingStatus({ pollMs: 2000 })
  const [waitedLong, setWaitedLong] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setWaitedLong(true), 60_000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (status.data?.passEndsAt && returnTo) router.replace(returnTo)
  }, [status.data?.passEndsAt, returnTo, router])

  if (status.data?.passEndsAt) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl">Erişimin açıldı</h1>
        <p className="mt-2 text-muted">{formatPassEnd(status.data.passEndsAt)} tarihine kadar istediğin kadar uyarlayabilirsin.</p>
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl">Ödemen alınıyor…</h1>
      <p className="mt-2 text-muted">
        {waitedLong
          ? "Ödemen alındıysa erişimin birkaç dakika içinde açılır. Açılmazsa iletisim@uyarla.com.tr adresine yaz."
          : "Birkaç saniye sürebilir, sayfadan ayrılma."}
      </p>
    </div>
  )
}
```

`apps/web/src/features/billing/components/PassSection.tsx`:

```tsx
"use client"

import Link from "next/link"
import { useBillingStatus } from "@/features/billing/api"
import { formatPassEnd } from "@/features/billing/format"

/** Hesabım'da erişim dönemi. */
export function PassSection() {
  const { data } = useBillingStatus()
  if (!data) return null
  return (
    <section className="rounded-card border border-border bg-card p-5">
      <h2 className="text-lg">Erişim dönemi</h2>
      <p className="mt-1 text-sm text-muted">
        {data.passEndsAt
          ? `${formatPassEnd(data.passEndsAt)} tarihine kadar açık.`
          : data.freeUsed
            ? "Ücretsiz uyarlama hakkını kullandın."
            : "Bir ücretsiz uyarlama hakkın var."}
      </p>
      <Link href="/plans" className="mt-3 inline-block text-sm font-semibold">
        {data.passEndsAt ? "Süreyi uzat" : "Paket al"}
      </Link>
    </section>
  )
}
```

`apps/web/src/app/(app)/(focused)/plans/page.tsx`:

```tsx
import { PlansView } from "@/features/billing/components/PlansView"
import { plansFromEnv } from "@/features/billing/plans"

export const metadata = { title: "Paketler · uyarla" }
export const dynamic = "force-dynamic"

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ donus?: string }> }) {
  const { donus } = await searchParams
  const returnTo = donus && donus.startsWith("/") && !donus.startsWith("//") ? donus : null
  return <PlansView plans={plansFromEnv(process.env)} returnTo={returnTo} />
}
```

`apps/web/src/app/(app)/(focused)/plans/tesekkurler/page.tsx`:

```tsx
import { ThanksView } from "@/features/billing/components/ThanksView"

export const metadata = { title: "Teşekkürler · uyarla" }

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ donus?: string }> }) {
  const { donus } = await searchParams
  const returnTo = donus && donus.startsWith("/") && !donus.startsWith("//") ? donus : null
  return <ThanksView returnTo={returnTo} />
}
```

`AccountView.tsx`'te "CV'lerim" bölümünden önce `<PassSection />` ekle (import `@/features/billing/components/PassSection`).

- [ ] **Step 4: Yeşil.**
  - Run: `cd apps/web && pnpm exec vitest run && pnpm exec tsc --noEmit`
  - Expected: PASS, tsc temiz.

- [ ] **Step 5: Elle.** Geliştirme sunucusu açıkken, kayıtlı bir test kullanıcısıyla (ücretsiz hakkı kullanılmış) `/plans` açılıyor: paketler, onay kutusu, kutu işaretlenmeden "Öde" kapalı. Ekran görüntüsü `.superpowers/` altına.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/features/billing/api.ts apps/web/src/features/billing/format.ts apps/web/src/features/billing/format.test.ts apps/web/src/features/billing/components/PlansView.tsx apps/web/src/features/billing/components/ThanksView.tsx apps/web/src/features/billing/components/PassSection.tsx "apps/web/src/app/(app)/(focused)/plans/page.tsx" "apps/web/src/app/(app)/(focused)/plans/tesekkurler/page.tsx" apps/web/src/features/account/components/AccountView.tsx
git commit -m "Paket ekranı, teşekkür sayfası ve Hesabım'da erişim dönemi (DOG-34)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Hukuki metinler ve yapılandırma

**Files:**
- Create: `apps/web/src/app/(marketing)/refund/page.tsx`
- Modify: `apps/web/src/app/(marketing)/terms/page.tsx` (§6 Ücretler)
- Modify: `apps/web/src/app/(marketing)/privacy/page.tsx` (işleyenler listesi)
- Modify: `.env.example`
- Test: `apps/web/src/lib/legalPages.test.ts`

- [ ] **Step 1: Test.** `apps/web/src/lib/legalPages.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const page = (p: string) => readFileSync(join(__dirname, "../app/(marketing)", p, "page.tsx"), "utf8")

describe("legal pages (DOG-34)", () => {
  it("refund page explains the withdrawal exception and how to ask for a refund", () => {
    const text = page("refund")
    expect(text).toContain("cayma hakkı")
    expect(text).toContain("iletisim@uyarla.com.tr")
  })

  it("privacy lists Polar as the payment processor", () => {
    expect(page("privacy")).toContain("Polar")
  })

  it("terms describe one-time passes without auto-renewal", () => {
    expect(page("terms")).toContain("otomatik yenileme")
  })
})
```

- [ ] **Step 2: Kırmızı.**
  - Run: `cd apps/web && pnpm exec vitest run src/lib/legalPages.test.ts`
  - Expected: FAIL (refund sayfası yok).

- [ ] **Step 3: Metinler.**
  - `apps/web/src/app/(marketing)/refund/page.tsx`: `terms/page.tsx`'in düzenini kopyala; `metadata.title`: "İade ve cayma · uyarla". Bölümler:
    1. **Ne satın alıyorsun:** 1 hafta, 1 ay ya da 3 aylık erişim dönemi; tek seferlik ödeme, otomatik yenileme yok.
    2. **Cayma hakkı:** dijital içerikte, ödeme öncesi açık onayınla erişim hemen başladığı için Mesafeli Sözleşmeler Yönetmeliği md. 15 gereği cayma hakkı kullanılamaz.
    3. **Yine de iade:** teknik bir sorun nedeniyle hizmeti kullanamadıysan 14 gün içinde iletisim@uyarla.com.tr adresine yaz; değerlendirip Polar üzerinden iade ederiz. İade edilen dönemin erişimi kapanır.
    4. **Ödeme ve fatura:** ödemeyi merchant of record olarak Polar (Polar Software Inc.) alır; fatura e-postana gelir.
  - `terms/page.tsx` §6 Ücretler: metni şu anlamla değiştir. Analiz ücretsiz, ilk uyarlama ücretsiz; sonrası tek seferlik erişim dönemi; otomatik yenileme yok; fiyatlar paket ekranında; iade koşulları `/refund`.
  - `privacy/page.tsx` işleyenler listesine, Sentry maddesinden sonra:

```tsx
          <li>
            <strong>Polar (ABD), ödeme:</strong> paket satın alırken ödemeyi alır ve faturanı gönderir. Kart bilgin
            uyarla&apos;ya hiç gelmez; Polar'a yalnızca e-posta adresin ve hesap kimliğin iletilir.
          </li>
```

  - `.env.example` sonuna:

```bash
# Ödeme (DOG-34): Polar. Önce sandbox; üretime geçiş POLAR_SERVER=production.
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_SERVER="sandbox"
# Polar ürün kimlikleri; boş olan paket gösterilmez.
POLAR_PRODUCT_WEEK=
POLAR_PRODUCT_MONTH=
POLAR_PRODUCT_QUARTER=
# Paket ekranında gösterilen TL fiyatlar (ödeme tutarı Polar'dan): "week:149, month:349, quarter:799"
PLAN_PRICES_TRY=
```

- [ ] **Step 4: Yeşil.**
  - Run: `cd apps/web && pnpm exec vitest run && pnpm exec tsc --noEmit`
  - Expected: PASS, tsc temiz.

- [ ] **Step 5: Commit.**

```bash
git add "apps/web/src/app/(marketing)/refund/page.tsx" "apps/web/src/app/(marketing)/terms/page.tsx" "apps/web/src/app/(marketing)/privacy/page.tsx" apps/web/src/lib/legalPages.test.ts .env.example
git commit -m "İade ve cayma sayfası, kullanım koşulları ve gizlilikte ödeme (DOG-34)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Sandbox'ta uçtan uca deneme, PR ve üretim

**Önkoşul (kullanıcıdan):**
- Polar sandbox organizasyonu: üç tek seferlik TL ürünü, organizasyon erişim anahtarı.
- Webhook uç noktası `https://<önizleme ya da üretim>/api/billing/webhook`; olaylar `order.paid`, `order.refunded`. İmza anahtarı `.env`'e ve Vercel'e.

- [ ] **Step 1: Yerel tümleşik ve birim testlerin tamamı.**
  - Run: `cd apps/web && pnpm exec vitest run && S3_BUCKET= pnpm exec dotenv -e ../../.env -- sh -c 'S3_BUCKET= vitest run --config vitest.integration.config.ts' && cd ../.. && pnpm -r typecheck`
  - Expected: hepsi PASS.

- [ ] **Step 2: PR ve Vercel.** Dalı it, PR aç. Vercel kontrolü SUCCESS olmalı (fonksiyon sınırı dahil). Aşarsa deploy kaydının `errorMessage`'ını oku (`vercel api /v13/deployments/<id>?teamId=team_NrML8YXPSk5Y76Z2tb1DEDsa`) ve kullanıcıya route birleştirme ya da Pro seçeneğini sun.

- [ ] **Step 3: Sandbox uçtan uca (önizleme adresinde).**
  - Önizleme ortamına sandbox değişkenlerini ekle (`vercel api …/env?upsert=true`, target `preview`).
  - Test kullanıcısıyla: ilk uyarlama → ikinci uyarlamada `/plans` → onay → "Öde" → Polar sandbox ödeme sayfası (Türkçe, TL) → test kartı `4242 4242 4242 4242` → teşekkür sayfası → dönem açılıyor → uyarlama kaldığı yerden başlıyor.
  - Polar panelinden siparişi iade et → `/api/billing/status` `passEndsAt: null`, uyarlama tekrar 402.
  - Ekran görüntüleri `.superpowers/` altına.

- [ ] **Step 4: Üretim göçü ve merge.** Neon üretim veritabanına `cd packages/db && DATABASE_URL="<neon>" pnpm exec prisma migrate deploy`. Sonra merge. Üretimde `POLAR_SERVER` sandbox kalabilir; gerçek satışa geçiş K2 fiyatlarından ve Polar hesabının üretim onayından sonra ayrı bir adım.

- [ ] **Step 5: Linear.** DOG-34'e sonuç yorumu; kalan adımlar (üretim Polar onayı, fiyatlar, hukuki kontrol) ayrı issue olarak.
