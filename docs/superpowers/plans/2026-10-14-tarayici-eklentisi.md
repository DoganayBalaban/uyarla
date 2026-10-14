# Tarayıcı Eklentisi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome eklentisi: kullanıcı bir ilan sayfasındayken simgeye (ya da seçili metinde sağ tık menüsüne) tıklayınca uyarla'nın analiz sayfası ilan metni dolu açılıyor; varsayılan CV'si olan kayıtlı kullanıcıda analiz kendiliğinden başlıyor.

**Architecture:**
- **Ortak çıkarma:** web'deki saf ilan çıkarma kodu (`extractPostingText`, `htmlToText`) core'a taşınıyor; web ve eklenti aynı kodu kullanıyor.
- **Eklenti (`apps/extension`, Manifest V3):** popup'sız. İzinler: activeTab, scripting, contextMenus, notifications. Sitelere kalıcı izin yok. uyarla'yı `#ilan=…&kaynak=…` adresiyle yeni sekmede açıyor.
- **Web (`AnalyzeView`):** `#` kısmını okuyup formu dolduruyor, `#`'i siliyor ve koşullar tutarsa bir kez gönderiyor.

**Tech Stack:** TypeScript 5, esbuild (paketleme), vitest, `@types/chrome`, sharp (simgeler), jszip (zip), Next 15 / React 18 (web).

**Spec:** `docs/superpowers/specs/2026-10-14-tarayici-eklentisi-design.md`

## Global Constraints

- **İsimler ve metinler:** isimler İngilizce; yorumlar ve kullanıcıya görünen metinler Türkçe.
- **Git:** `git add` her zaman açık yollarla (dizin verilmez; `eval/runs` dosyaları karışır). Commit mesajı `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` ile biter.
- **Vercel:** yeni bir API route eklenmez (Vercel Hobby 12 fonksiyon sınırı).
- **Eklenti izinleri:** `manifest.json` izinleri tam olarak `["activeTab", "scripting", "contextMenus", "notifications"]`. `host_permissions` yok.
- **Adres:** `UYARLA_URL` build sırasında verilir. Varsayılan `https://uyarla.vercel.app`; `pnpm dev` (izleme) için `http://localhost:3000`.
- **Metin sınırları:** en az `MIN_JOB_TEXT_LENGTH` (50) karakter ilan metni; eklentinin URL'ye koyduğu metin en fazla `MAX_EXTENSION_TEXT` = 20000 karakter.
- **Eklenti ağı:** eklenti kendi başına hiçbir sunucuya istek atmaz, depolama kullanmaz.
- **Merge:** Vercel kontrolü SUCCESS olmadan yapılmaz.

## Review Focus

1. **Özel karakterler:** `+`, `%`, `&`, `#` ve Türkçe harf içeren ilan metni (`C++ & %50 prim #1 İşçi`) URL'den bozulmadan dönmeli (`uyarlaUrl` ↔ `readExtensionHandoff` gidiş-dönüş testi, Task 2 ve 3).
2. **Çift gönderme:** React Strict Mode efekti iki kez çalıştırsa da analiz bir kez gönderilmeli (`consumeAutoSubmit` tek kullanımlık; Task 2 testi).
3. **Anonim ya da oturumsuz kullanıcı:** eklentiden gelen ilan formu doldurmalı ama kendiliğinden göndermemeli (`shouldAutoSubmit` testi, Task 2).
4. **Kalıcı sonuç adresiyle (`?analiz=`) açılan sayfa:** `#ilan` olsa bile sonuç gösterimi bozulmamalı; handoff yok sayılır (Task 2 testi).
5. **Seçili metin 50 karakterden kısa ya da yalnızca boşluk:** uyarla açılmamalı, bildirim çıkmalı (`pickSelection` testi, Task 3).

---

## Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `packages/core/src/jobPosting/extract.ts` (yeni) | Saf ilan çıkarma: `htmlToText`, `extractPostingText`, `ExtractedPosting` (web'den taşındı). |
| `packages/core/src/jobPosting/extract.test.ts` (yeni) | Taşınan testler + LinkedIn JSON-LD testi. |
| `packages/core/package.json` | `exports` içine `"./jobPosting/extract"`. |
| `apps/web/src/server/jobPostingFromUrl.ts` | Yalnızca `ALLOWED_PREFIXES` ve `isAllowedPath` kalır; çıkarma core'dan yeniden dışa açılır. |
| `apps/web/src/server/jobPostingFromUrl.test.ts` | Yalnızca `isAllowedPath` testleri kalır. |
| `apps/web/src/features/analysis/extensionHandoff.ts` (yeni) | `readExtensionHandoff`, `shouldAutoSubmit`, `createAutoSubmitGate`. |
| `apps/web/src/features/analysis/extensionHandoff.test.ts` (yeni) | Yukarıdakilerin testleri. |
| `apps/web/src/features/analysis/components/AnalyzeView.tsx` | Handoff'u okuyup formu doldurma ve kendiliğinden gönderme. |
| `apps/web/src/app/(marketing)/privacy/page.tsx` | Eklenti satırı. |
| `apps/extension/package.json`, `tsconfig.json`, `vitest.config.ts` (yeni) | Paket iskeleti. |
| `apps/extension/manifest.json` (yeni) | MV3 bildirimi. |
| `apps/extension/src/posting.ts` (yeni) | Saf: `pickPosting`, `pickSelection`, `uyarlaUrl`, sabitler. |
| `apps/extension/src/posting.test.ts` (yeni) | Saf parçaların testleri. |
| `apps/extension/src/background.ts` (yeni) | Chrome API katmanı: simge, menü, bildirim, sekme açma. |
| `apps/extension/scripts/build.mjs` (yeni) | esbuild paketleme, dosya kopyalama, zip. |
| `apps/extension/scripts/icons.mjs` (yeni) | `apps/web/src/app/icon.svg`'den 16/32/48/128 PNG. |
| `apps/extension/icons/*.png` (yeni, üretilmiş) | Simgeler. |
| `apps/extension/README.md` (yeni) | Kurulum (K2), build, mağaza metni. |

---

### Task 1: İlan çıkarma kodunu core'a taşı

**Files:**
- Create: `packages/core/src/jobPosting/extract.ts`
- Create: `packages/core/src/jobPosting/extract.test.ts`
- Modify: `packages/core/package.json` (exports)
- Modify: `apps/web/src/server/jobPostingFromUrl.ts`
- Modify: `apps/web/src/server/jobPostingFromUrl.test.ts`

**Interfaces:**
- Produces: `import { extractPostingText, htmlToText, type ExtractedPosting } from "@uyarla/core/jobPosting/extract"`
  - `extractPostingText(html: string, host?: string): ExtractedPosting | null`
  - `htmlToText(html: string): string`
  - `ExtractedPosting = { text: string; position: string | null; company: string | null; source: "json-ld" | "sayfa" }`
- Web'de `@/server/jobPostingFromUrl` aynı isimleri dışa açmaya devam eder (`api/job-url/route.ts` değişmez).

- [ ] **Step 1: Core test dosyasını oluştur.** `apps/web/src/server/jobPostingFromUrl.test.ts` içindeki `describe("htmlToText", …)` ve `describe("extractPostingText", …)` bloklarını **olduğu gibi** `packages/core/src/jobPosting/extract.test.ts`'e taşı. Başına şunu koy:

```ts
import { describe, expect, it } from "vitest"
import { extractPostingText, htmlToText } from "./extract.js"
```

Ardından LinkedIn testini ekle:

```ts
describe("extractPostingText · LinkedIn (DOG-70)", () => {
  it("reads the JobPosting JSON-LD a LinkedIn job page publishes", () => {
    const html = `<html><head><title>Muhasebe Uzmanı | LinkedIn</title>
      <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: "Muhasebe Uzmanı",
        hiringOrganization: { "@type": "Organization", name: "Mimeda" },
        description:
          "<p>Genel muhasebe süreçlerini yürüteceksin.</p><ul><li>3 yıl muhasebe deneyimi</li><li>Logo ERP bilgisi</li><li>MS Excel orta seviye</li></ul>",
      })}</script></head><body><nav>menü</nav></body></html>`

    const posting = extractPostingText(html, "tr.linkedin.com")

    expect(posting).toMatchObject({ position: "Muhasebe Uzmanı", company: "Mimeda", source: "json-ld" })
    expect(posting!.text).toContain("- Logo ERP bilgisi")
    expect(posting!.text).not.toContain("menü")
  })
})
```

- [ ] **Step 2: Testin kırmızı olduğunu gör.**
  - Run: `cd packages/core && pnpm exec vitest run src/jobPosting`
  - Expected: FAIL, `Failed to load url ./extract.js`.

- [ ] **Step 3: Taşı.**
  - `apps/web/src/server/jobPostingFromUrl.ts` içinde `ENTITIES` sabitinden dosya sonuna kadar olan bütün kodu `packages/core/src/jobPosting/extract.ts`'e taşı: `decodeEntities`, `htmlToText`, `ExtractedPosting`, `findJobPosting`, `jsonLdPosting`, `SiteRule`, `COMMON_ENDINGS`, `SITE_RULES`, `findRule`, `truncate`, `extractPostingText`. Yorumlar da birlikte taşınır.
  - Dosyanın başına şu açıklamayı koy:

```ts
/**
 * Sayfa HTML'inden ilan metni çıkarmak. Saf: ağa çıkmıyor.
 *
 * Web'in "ilanı bağlantıdan al" ucu (sunucu, izinli siteler) ve tarayıcı
 * eklentisi (kullanıcının açtığı sayfa, DOG-70) aynı kodu kullanıyor;
 * iki kopya zamanla ayrışırdı.
 */
```

  - `apps/web/src/server/jobPostingFromUrl.ts` yalnızca dosya başı yorumu, `ALLOWED_PREFIXES` ve `isAllowedPath` ile kalır; sonuna şunu ekle:

```ts
export { extractPostingText, htmlToText, type ExtractedPosting } from "@uyarla/core/jobPosting/extract"
```

  - `packages/core/package.json` `exports` içine ekle: `"./jobPosting/extract": "./src/jobPosting/extract.ts"`.
  - `apps/web/src/server/jobPostingFromUrl.test.ts` içinde yalnızca `describe("isAllowedPath", …)` kalır; import satırı `import { isAllowedPath } from "@/server/jobPostingFromUrl"` olur.

- [ ] **Step 4: Testlerin yeşil olduğunu gör.**
  - Run: `cd packages/core && pnpm exec vitest run src/jobPosting && cd ../../apps/web && pnpm exec vitest run src/server/jobPostingFromUrl.test.ts && pnpm exec tsc --noEmit`
  - Expected: core'da taşınan testler ve LinkedIn testi PASS; web'de `isAllowedPath` testleri PASS; tsc temiz.

- [ ] **Step 5: Commit.**

```bash
git add packages/core/src/jobPosting/extract.ts packages/core/src/jobPosting/extract.test.ts packages/core/package.json apps/web/src/server/jobPostingFromUrl.ts apps/web/src/server/jobPostingFromUrl.test.ts
git commit -m "İlan çıkarma kodu core'a taşındı: web ve eklenti ortak kullanacak (DOG-70)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Web'de eklentiden gelen ilanı karşıla

**Files:**
- Create: `apps/web/src/features/analysis/extensionHandoff.ts`
- Create: `apps/web/src/features/analysis/extensionHandoff.test.ts`
- Modify: `apps/web/src/features/analysis/components/AnalyzeView.tsx`
- Modify: `apps/web/src/app/(marketing)/privacy/page.tsx`

**Interfaces:**
- Consumes: `MIN_JOB_TEXT_LENGTH` (`@/features/analysis/schema`, 50).
- Produces:
  - `readExtensionHandoff(hash: string, search: string): { jobText: string; sourceUrl: string | null } | null`
  - `shouldAutoSubmit(input: { registered: boolean; resumeId: string | undefined; jobText: string }): boolean`
  - `createAutoSubmitGate(): () => boolean`: ilk çağrıda `true`, sonrakilerde `false`.
- Adres biçimi (Task 3 aynısını üretir): `#ilan=<encodeURIComponent(metin)>&kaynak=<encodeURIComponent(adres)>`; `kaynak` isteğe bağlı.

- [ ] **Step 1: Testleri yaz.** `apps/web/src/features/analysis/extensionHandoff.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { createAutoSubmitGate, readExtensionHandoff, shouldAutoSubmit } from "@/features/analysis/extensionHandoff"

const TEXT = "Muhasebe Uzmanı — Mimeda\n\nGenel muhasebe süreçleri, Logo ERP, 3 yıl deneyim, MS Excel orta seviye."
const hash = (text: string, source?: string) =>
  `#ilan=${encodeURIComponent(text)}${source ? `&kaynak=${encodeURIComponent(source)}` : ""}`

describe("readExtensionHandoff", () => {
  it("reads the posting text and its source page", () => {
    expect(readExtensionHandoff(hash(TEXT, "https://www.kariyer.net/is-ilani/x-1"), "")).toEqual({
      jobText: TEXT,
      sourceUrl: "https://www.kariyer.net/is-ilani/x-1",
    })
  })

  it("round-trips special characters", () => {
    // Review Focus 1: + % & # ve Türkçe harf bozulmamalı.
    const tricky = `${TEXT} C++ & %50 prim #1 İşçi ğüşöç`
    expect(readExtensionHandoff(hash(tricky), "")!.jobText).toBe(tricky)
  })

  it("ignores a missing, short or malformed handoff", () => {
    expect(readExtensionHandoff("", "")).toBeNull()
    expect(readExtensionHandoff("#baska=1", "")).toBeNull()
    expect(readExtensionHandoff(hash("kısa"), "")).toBeNull()
    expect(readExtensionHandoff("#ilan=%E0%A4%A", "")).toBeNull()
  })

  it("ignores the handoff on a saved-result address", () => {
    // Review Focus 4: ?analiz= sonucu gösteriyor; form doldurulmaz.
    expect(readExtensionHandoff(hash(TEXT), "?analiz=abc")).toBeNull()
  })

  it("drops a source that is not an http(s) address", () => {
    expect(readExtensionHandoff(hash(TEXT, "javascript:alert(1)"), "")!.sourceUrl).toBeNull()
  })
})

describe("shouldAutoSubmit", () => {
  it("submits for a registered user with a preselected resume", () => {
    expect(shouldAutoSubmit({ registered: true, resumeId: "r1", jobText: TEXT })).toBe(true)
  })

  it("waits for an anonymous user or a missing resume", () => {
    // Review Focus 3.
    expect(shouldAutoSubmit({ registered: false, resumeId: "r1", jobText: TEXT })).toBe(false)
    expect(shouldAutoSubmit({ registered: true, resumeId: undefined, jobText: TEXT })).toBe(false)
  })
})

describe("createAutoSubmitGate", () => {
  it("opens once", () => {
    // Review Focus 2: Strict Mode efekti iki kez çalıştırsa da tek gönderim.
    const gate = createAutoSubmitGate()
    expect(gate()).toBe(true)
    expect(gate()).toBe(false)
  })
})
```

- [ ] **Step 2: Kırmızıyı gör.**
  - Run: `cd apps/web && pnpm exec vitest run src/features/analysis/extensionHandoff.test.ts`
  - Expected: FAIL, modül yok.

- [ ] **Step 3: Uygula.** `apps/web/src/features/analysis/extensionHandoff.ts`:

```ts
import { MIN_JOB_TEXT_LENGTH } from "@/features/analysis/schema"

/**
 * Tarayıcı eklentisinden gelen ilan (DOG-70).
 *
 * Eklenti uyarla'yı `/analyze#ilan=<metin>&kaynak=<sayfa>` ile açıyor.
 * `#` kısmı sunucuya gitmiyor: ilan metni istek günlüklerine düşmüyor ve
 * yeni bir API ucu gerekmiyor.
 */
export interface ExtensionHandoff {
  jobText: string
  sourceUrl: string | null
}

export function readExtensionHandoff(hash: string, search: string): ExtensionHandoff | null {
  // Kalıcı sonuç adresi (?analiz=) sonucu gösteriyor; form doldurulmuyor.
  if (new URLSearchParams(search).has("analiz")) return null
  if (!hash.startsWith("#ilan=")) return null
  let params: URLSearchParams
  try {
    // URLSearchParams "+"yı boşluğa çeviriyor; eklenti encodeURIComponent
    // kullandığı için "+" zaten %2B. Bozuk kodlamayı decodeURIComponent yakalıyor.
    params = new URLSearchParams(hash.slice(1))
    decodeURIComponent(hash.slice(1))
  } catch {
    return null
  }
  const jobText = (params.get("ilan") ?? "").trim()
  if (jobText.length < MIN_JOB_TEXT_LENGTH) return null
  const source = params.get("kaynak")
  const sourceUrl = source && /^https?:\/\//i.test(source) ? source : null
  return { jobText, sourceUrl }
}

/** Kayıtlı kullanıcı ve ön seçili kütüphane CV'si varsa analiz beklemeden başlar. */
export function shouldAutoSubmit(input: { registered: boolean; resumeId: string | undefined; jobText: string }): boolean {
  return input.registered && !!input.resumeId && input.jobText.trim().length >= MIN_JOB_TEXT_LENGTH
}

/** Tek kullanımlık kapı: Strict Mode efekti iki kez çalıştırsa da bir gönderim. */
export function createAutoSubmitGate(): () => boolean {
  let open = true
  return () => {
    if (!open) return false
    open = false
    return true
  }
}
```

- [ ] **Step 4: Yeşili gör.**
  - Run: `cd apps/web && pnpm exec vitest run src/features/analysis/extensionHandoff.test.ts`
  - Expected: PASS (8 test).

- [ ] **Step 5: `AnalyzeView`'a bağla.**
  - **Import:** `import { createAutoSubmitGate, readExtensionHandoff, shouldAutoSubmit, type ExtensionHandoff } from "@/features/analysis/extensionHandoff"`.
  - **Bileşen içine** `library`/`resumes` tanımlarının hemen altına ekle:

```tsx
  // Tarayıcı eklentisinden gelen ilan (DOG-70): formu doldur, # kısmını sil.
  const [handoff, setHandoff] = useState<ExtensionHandoff | null>(null)
  const autoSubmitGate = useRef(createAutoSubmitGate())
  useEffect(() => {
    const incoming = readExtensionHandoff(window.location.hash, window.location.search)
    if (!incoming) return
    setValue("jobText", incoming.jobText, { shouldValidate: true })
    if (incoming.sourceUrl) setValue("postingUrl", incoming.sourceUrl)
    // Geri tuşunda ya da yenilemede form yeniden dolmasın.
    window.history.replaceState(null, "", window.location.pathname + window.location.search)
    setHandoff(incoming)
  }, [setValue])

  useEffect(() => {
    if (!handoff || busy) return
    if (!shouldAutoSubmit({ registered, resumeId: selectedResumeId ?? undefined, jobText: handoff.jobText })) return
    if (!autoSubmitGate.current()) return
    void handleSubmit(onSubmit)()
  }, [handoff, registered, selectedResumeId, busy, handleSubmit])
```

  - `useRef` zaten içe aktarılmış. `selectedResumeId` zaten `watch("resumeId")`'den geliyor; bu efekt onun tanımından **sonra** yer almalı. Gerekirse efekti `selectedResumeId` satırının altına taşı. `onSubmit` fonksiyon bildirimi olduğu için yukarı taşınır (hoisting); ESLint exhaustive-deps uyarısı için `onSubmit`'i bağımlılığa ekleme, gate tek gönderimi garanti ediyor.

- [ ] **Step 6: Gizlilik metnine eklenti satırı.** `apps/web/src/app/(marketing)/privacy/page.tsx` işleyenler listesinde "Sentry, hata izleme" maddesinden sonra:

```tsx
          <li>
            <strong>Tarayıcı eklentisi:</strong> yalnızca sen tıkladığında açık sayfadaki ilan metnini
            uyarla&apos;ya aktarır; başka bir veri toplamaz, kendi başına hiçbir sunucuya bağlanmaz.
          </li>
```

- [ ] **Step 7: Doğrula.**
  - Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm exec vitest run`
  - Expected: tsc temiz, bütün testler PASS.
  - **Elle:**
    - Dev sunucusu açıkken kayıtlı ve kütüphanesinde varsayılan CV'si olan bir test kullanıcısıyla şunu aç: `http://localhost:3000/analyze#ilan=<en az 50 karakter, encodeURIComponent>`. Beklenen: adres çubuğunda `#` kısmı silinir ve analiz kendiliğinden başlar.
    - Oturumsuz açıldığında ilan alanı dolu gelir, analiz başlamaz.

- [ ] **Step 8: Commit.**

```bash
git add apps/web/src/features/analysis/extensionHandoff.ts apps/web/src/features/analysis/extensionHandoff.test.ts apps/web/src/features/analysis/components/AnalyzeView.tsx "apps/web/src/app/(marketing)/privacy/page.tsx"
git commit -m "Analiz sayfası eklentiden gelen ilanı alıyor, uygunsa kendiliğinden başlıyor (DOG-70)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Eklenti paketi ve saf parçalar

**Files:**
- Create: `apps/extension/package.json`, `apps/extension/tsconfig.json`, `apps/extension/vitest.config.ts`
- Create: `apps/extension/src/posting.ts`, `apps/extension/src/posting.test.ts`

**Interfaces:**
- Consumes: `extractPostingText` (`@uyarla/core/jobPosting/extract`, Task 1).
- Produces (`apps/extension/src/posting.ts`):
  - `MIN_JOB_TEXT_LENGTH = 50`, `MAX_EXTENSION_TEXT = 20000`
  - `pickPosting(page: { html: string; url: string }): string | null`
  - `pickSelection(selection: string | undefined): string | null`
  - `uyarlaUrl(base: string, text: string, sourceUrl: string | null): string`

- [ ] **Step 1: Paket iskeleti.**
  - `apps/extension/package.json`:

```json
{
  "name": "@uyarla/extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build.mjs",
    "dev": "node scripts/build.mjs --watch",
    "icons": "node scripts/icons.mjs",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@uyarla/core": "workspace:*"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.300",
    "esbuild": "^0.28.2",
    "jszip": "^3.10.2",
    "sharp": "^0.35.4",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

  - `apps/extension/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "types": ["chrome"],
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "scripts"]
}
```

  - `apps/extension/vitest.config.ts`: `import { defineConfig } from "vitest/config"; export default defineConfig({ test: { include: ["src/**/*.test.ts"] } })`.
  - Run: `pnpm install`. Expected: `@uyarla/extension` çalışma alanında görünüyor. Sürümler kurulumda çözülemezse workspace'teki mevcut sürümlerle eşitle: `grep '"esbuild@\|"vitest"' pnpm-lock.yaml`.

- [ ] **Step 2: Testleri yaz.** `apps/extension/src/posting.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { MAX_EXTENSION_TEXT, pickPosting, pickSelection, uyarlaUrl } from "./posting.js"

const LONG = "Genel muhasebe süreçlerini yürüteceksin. ".repeat(10)

describe("pickPosting", () => {
  it("returns the posting text found on the page", () => {
    const html = `<html><body><main><h1>Muhasebe Uzmanı</h1><p>${LONG}</p></main></body></html>`
    expect(pickPosting({ html, url: "https://www.yenibiris.com/is-ilani/1" })).toContain("Genel muhasebe")
  })

  it("returns null for a page without a posting", () => {
    expect(pickPosting({ html: "<html><body><p>Giriş yap</p></body></html>", url: "https://x.com" })).toBeNull()
  })
})

describe("pickSelection", () => {
  it("accepts a long enough selection", () => {
    expect(pickSelection(`  ${LONG}  `)).toBe(LONG.trim())
  })

  it("rejects a short, blank or missing selection", () => {
    // Review Focus 5.
    expect(pickSelection("kısa")).toBeNull()
    expect(pickSelection("   \n  ")).toBeNull()
    expect(pickSelection(undefined)).toBeNull()
  })
})

describe("uyarlaUrl", () => {
  it("puts the text and source in the fragment, encoded", () => {
    const url = new URL(uyarlaUrl("https://uyarla.vercel.app", "C++ & %50 #1 İşçi", "https://kariyer.net/a?b=1"))
    expect(url.origin + url.pathname).toBe("https://uyarla.vercel.app/analyze")
    expect(url.search).toBe("")
    const params = new URLSearchParams(url.hash.slice(1))
    expect(params.get("ilan")).toBe("C++ & %50 #1 İşçi")
    expect(params.get("kaynak")).toBe("https://kariyer.net/a?b=1")
  })

  it("leaves the source out when there is none", () => {
    expect(uyarlaUrl("http://localhost:3000", LONG, null)).not.toContain("kaynak=")
  })

  it("caps very long text", () => {
    const url = new URL(uyarlaUrl("https://uyarla.vercel.app", "a".repeat(MAX_EXTENSION_TEXT + 500), null))
    expect(new URLSearchParams(url.hash.slice(1)).get("ilan")!.length).toBe(MAX_EXTENSION_TEXT)
  })
})
```

- [ ] **Step 3: Kırmızıyı gör.**
  - Run: `cd apps/extension && pnpm exec vitest run`
  - Expected: FAIL, `./posting.js` yok.

- [ ] **Step 4: Uygula.** `apps/extension/src/posting.ts`:

```ts
import { extractPostingText } from "@uyarla/core/jobPosting/extract"

/** Analiz formunun alt sınırıyla aynı (web `MIN_JOB_TEXT_LENGTH`). */
export const MIN_JOB_TEXT_LENGTH = 50
/** URL'ye konan metnin üst sınırı; ilanların büyük çoğunluğu bunun altında. */
export const MAX_EXTENSION_TEXT = 20000

/** Açık sayfadan ilan metni; bulunamazsa null (uyarla açılmaz, bildirim çıkar). */
export function pickPosting(page: { html: string; url: string }): string | null {
  let host: string | undefined
  try {
    host = new URL(page.url).hostname
  } catch {
    host = undefined
  }
  const text = extractPostingText(page.html, host)?.text.trim() ?? ""
  return text.length >= MIN_JOB_TEXT_LENGTH ? text : null
}

/** Sağ tık menüsünden gelen seçili metin. */
export function pickSelection(selection: string | undefined): string | null {
  const text = (selection ?? "").trim()
  return text.length >= MIN_JOB_TEXT_LENGTH ? text : null
}

/**
 * uyarla'nın analiz sayfası, ilan metni `#` kısmında. `#` sunucuya gitmiyor:
 * metin istek günlüklerine düşmüyor. encodeURIComponent "+"yı da kodluyor;
 * web tarafı URLSearchParams ile okuyor (bkz. extensionHandoff.ts).
 */
export function uyarlaUrl(base: string, text: string, sourceUrl: string | null): string {
  const parts = [`ilan=${encodeURIComponent(text.slice(0, MAX_EXTENSION_TEXT))}`]
  if (sourceUrl) parts.push(`kaynak=${encodeURIComponent(sourceUrl)}`)
  return `${base.replace(/\/+$/, "")}/analyze#${parts.join("&")}`
}
```

- [ ] **Step 5: Yeşili gör.**
  - Run: `cd apps/extension && pnpm exec vitest run && pnpm exec tsc --noEmit`
  - Expected: PASS (7 test), tsc temiz. `src/background.ts` henüz yok; `include` boş dosya uyarısı vermez.

- [ ] **Step 6: Commit.**

```bash
git add apps/extension/package.json apps/extension/tsconfig.json apps/extension/vitest.config.ts apps/extension/src/posting.ts apps/extension/src/posting.test.ts pnpm-lock.yaml
git commit -m "Eklenti paketi: ilan seçimi ve uyarla adresi (DOG-70)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Manifest, Chrome katmanı, simgeler ve build

**Files:**
- Create: `apps/extension/manifest.json`
- Create: `apps/extension/src/background.ts`
- Create: `apps/extension/scripts/build.mjs`, `apps/extension/scripts/icons.mjs`
- Create: `apps/extension/icons/16.png`, `32.png`, `48.png`, `128.png` (üretilir)
- Modify: `.gitignore` (`apps/extension/dist/`, `apps/extension/*.zip`)

**Interfaces:**
- Consumes: `pickPosting`, `pickSelection`, `uyarlaUrl` (Task 3). `UYARLA_URL`, esbuild `define` ile global bir string sabit.

- [ ] **Step 1: Manifest.** `apps/extension/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "uyarla — ilana uyumunu ölç",
  "short_name": "uyarla",
  "version": "0.1.0",
  "description": "Açık ilan sayfasını tek tıkla uyarla'ya gönder; CV'nin bu ilana uyumunu gör.",
  "permissions": ["activeTab", "scripting", "contextMenus", "notifications"],
  "background": { "service_worker": "background.js", "type": "module" },
  "action": {
    "default_title": "Bu ilana uyumumu ölç",
    "default_icon": { "16": "icons/16.png", "32": "icons/32.png", "48": "icons/48.png", "128": "icons/128.png" }
  },
  "icons": { "16": "icons/16.png", "32": "icons/32.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

- [ ] **Step 2: Chrome katmanı.** `apps/extension/src/background.ts`:

```ts
import { pickPosting, pickSelection, uyarlaUrl } from "./posting.js"

/** Build sırasında esbuild `define` ile veriliyor (scripts/build.mjs). */
declare const UYARLA_URL: string

const MENU_ID = "uyarla-secili-metin"
const NOT_FOUND =
  "Bu sayfada ilan bulamadık. İlan metnini seçip sağ tıkla \"Seçili metni uyarla ile ölç\" de."

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: "Seçili metni uyarla ile ölç", contexts: ["selection"] })
})

async function openUyarla(text: string, sourceUrl: string | null): Promise<void> {
  await chrome.tabs.create({ url: uyarlaUrl(UYARLA_URL, text, sourceUrl) })
}

async function notFound(tabId: number | undefined): Promise<void> {
  if (tabId !== undefined) {
    await chrome.action.setBadgeText({ tabId, text: "!" })
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#d97706" })
  }
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/128.png",
    title: "uyarla",
    message: NOT_FOUND,
  })
}

/** Simge: açık sekmenin HTML'i (activeTab ile, yalnızca bu tıklamada). */
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined || !tab.url) return notFound(tab.id)
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ html: document.documentElement.outerHTML, url: location.href }),
    })
    const page = result?.result as { html: string; url: string } | undefined
    const text = page ? pickPosting(page) : null
    if (!text) return notFound(tab.id)
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" })
    await openUyarla(text, page!.url)
  } catch {
    // chrome://, Web Mağazası gibi betik çalıştırılamayan sayfalar.
    await notFound(tab.id)
  }
})

/** Sağ tık: seçili metin, her sitede. */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return
  const text = pickSelection(info.selectionText)
  if (!text) return notFound(tab?.id)
  await openUyarla(text, tab?.url ?? null)
})
```

- [ ] **Step 3: Simgeler.** `apps/extension/scripts/icons.mjs`:

```js
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

// Web'in favicon kaynağı (marka simgesi); mağaza 16/32/48/128 piksel istiyor.
const dir = import.meta.dirname
const source = join(dir, "../../web/src/app/icon.svg")
const out = join(dir, "../icons")
mkdirSync(out, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  await sharp(source, { density: 512 }).resize(size, size).png().toFile(join(out, `${size}.png`))
  console.log(`icons/${size}.png`)
}
```

  - Run: `cd apps/extension && pnpm icons`
  - Expected: dört PNG. `Read` ile 128.png'ye bakıp logonun düzgün çıktığını doğrula.

- [ ] **Step 4: Build.** `apps/extension/scripts/build.mjs`:

```js
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as esbuild from "esbuild"
import JSZip from "jszip"

const root = join(import.meta.dirname, "..")
const dist = join(root, "dist")
const watch = process.argv.includes("--watch")
// İzleme kipi yerel geliştirme içindir: uyarla yerel sunucuda.
const uyarlaUrl = process.env.UYARLA_URL ?? (watch ? "http://localhost:3000" : "https://uyarla.vercel.app")

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
cpSync(join(root, "manifest.json"), join(dist, "manifest.json"))
cpSync(join(root, "icons"), join(dist, "icons"), { recursive: true })

const options = {
  entryPoints: [join(root, "src/background.ts")],
  outfile: join(dist, "background.js"),
  bundle: true,
  format: "esm",
  target: "chrome120",
  define: { UYARLA_URL: JSON.stringify(uyarlaUrl) },
  logLevel: "info",
}

if (watch) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
  console.log(`[eklenti] izleniyor · UYARLA_URL=${uyarlaUrl} · Chrome'da dist/ klasörünü yükle`)
} else {
  await esbuild.build({ ...options, minify: true })
  const { version } = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"))
  const zip = new JSZip()
  for (const file of ["manifest.json", "background.js", "icons/16.png", "icons/32.png", "icons/48.png", "icons/128.png"]) {
    zip.file(file, readFileSync(join(dist, file)))
  }
  const name = `uyarla-eklenti-${version}.zip`
  writeFileSync(join(root, name), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }))
  console.log(`[eklenti] ${name} · UYARLA_URL=${uyarlaUrl}`)
}
```

  - `.gitignore`'a ekle: `apps/extension/dist/` ve `apps/extension/*.zip`.
  - Run: `cd apps/extension && pnpm build && pnpm exec tsc --noEmit && unzip -l uyarla-eklenti-0.1.0.zip`
  - Expected: zip'te 6 dosya. `background.js` içinde `uyarla.vercel.app` geçiyor (`grep -c uyarla.vercel.app dist/background.js` → 1+). tsc temiz.
  - Paket boyutu kontrolü: `ls -l dist/background.js`. Yalnızca core'un `jobPosting/extract` alt yolu paketlenmeli; 50 KB'ı aşıyorsa core'un ağır modülleri yanlışlıkla girmiştir: import yolunu düzelt.

- [ ] **Step 5: Commit.**

```bash
git add apps/extension/manifest.json apps/extension/src/background.ts apps/extension/scripts/build.mjs apps/extension/scripts/icons.mjs apps/extension/icons/16.png apps/extension/icons/32.png apps/extension/icons/48.png apps/extension/icons/128.png .gitignore
git commit -m "Eklenti: manifest, simge ve sağ tık, build ve zip (DOG-70)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: README, mağaza metni ve uçtan uca doğrulama

**Files:**
- Create: `apps/extension/README.md`

- [ ] **Step 1: README.** `apps/extension/README.md`:

```markdown
# uyarla tarayıcı eklentisi

Açık ilan sayfasını tek tıkla uyarla'ya gönderir (DOG-70). Kayıtlı ve
kütüphanesinde varsayılan CV'si olan kullanıcıda analiz kendiliğinden başlar.

## Kurulum (K2 katılımcıları)

1. `uyarla-eklenti-<sürüm>.zip` dosyasını bir klasöre aç.
2. Chrome'da `chrome://extensions` adresine git, sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle**ye bas ve açtığın klasörü seç.
4. Araç çubuğundaki yapboz simgesinden uyarla'yı sabitle.

Kullanım: bir ilan sayfasındayken uyarla simgesine tıkla. İlan bulunamazsa
ilan metnini seç, sağ tıkla → "Seçili metni uyarla ile ölç".

## Geliştirme

- `pnpm --filter @uyarla/extension dev`: `dist/` izlenir, uyarla adresi `http://localhost:3000`.
- `pnpm --filter @uyarla/extension build`: `dist/` ve zip, adres `https://uyarla.vercel.app` (`UYARLA_URL=… pnpm build` ile değişir).
- `pnpm --filter @uyarla/extension icons`: simgeleri web'in `icon.svg`'sinden yeniden üretir.

## İzinler (mağaza incelemesi için gerekçeler)

| İzin | Neden |
|---|---|
| `activeTab` | Yalnızca simgeye tıklandığında o sekmenin ilanını okumak. |
| `scripting` | O sekmede ilan metnini almak için tek seferlik betik. |
| `contextMenus` | Seçili metin için "uyarla ile ölç" menüsü. |
| `notifications` | İlan bulunamadığında kullanıcıyı yönlendirmek. |

Sitelere kalıcı erişim (`host_permissions`) yok. Eklenti hiçbir sunucuya
istek atmaz ve veri saklamaz; ilan metni yalnızca kullanıcının açtığı uyarla
sekmesine, adresin `#` kısmında aktarılır.

## Mağaza açıklaması (yayın K2 sonrası)

**Kısa:** Açık ilan sayfasını tek tıkla uyarla'ya gönder; CV'nin bu ilana uyumunu gör.

**Uzun:** Kariyer.net, LinkedIn, yenibiris ya da başka bir sitede bir ilana
bakarken uyarla simgesine tıkla. İlan metni uyarla'ya aktarılır ve CV'nin bu
ilana ne kadar uyduğunu, hangi gereksinimlerin eksik kaldığını görürsün.
Ardından CV'ni bu ilana uyarlayabilirsin; olmayan deneyim eklenmez.

Gizlilik politikası: https://uyarla.vercel.app/privacy
```

- [ ] **Step 2: Bütün testler ve typecheck.**
  - Run: `pnpm -r typecheck && (cd packages/core && pnpm exec vitest run) && (cd apps/web && pnpm exec vitest run) && (cd apps/extension && pnpm exec vitest run)`
  - Expected: hepsi PASS, typecheck temiz.

- [ ] **Step 3: Uçtan uca doğrulama (elle).**
  - `UYARLA_URL=http://localhost:3000 pnpm --filter @uyarla/extension build`; dev sunucusu ve worker açık.
  - Kullanıcı Chrome'da `apps/extension/dist`'i paketlenmemiş öğe olarak yükler. Eklenti yükleme MCP ile yapılamıyor; kullanıcıdan istenir.
  - Kariyer.net, LinkedIn, yenibiris ve Jooble'da birer gerçek ilan sayfasında simgeye tıklanır. Beklenen:
    - uyarla sekmesi açılır, ilan alanı dolu gelir.
    - Kayıtlı ve varsayılan CV'si olan hesapta analiz kendiliğinden başlar.
    - Ekran görüntüleri `.superpowers/` altına kaydedilir.
  - Bir ilan sayfası olmayan sayfada simge → "!" rozeti ve bildirim.
  - Seçili metin → sağ tık menüsü → uyarla açılır.

- [ ] **Step 4: Commit, PR ve merge.**

```bash
git add apps/extension/README.md
git commit -m "Eklenti README: kurulum, izin gerekçeleri, mağaza metni (DOG-70)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push -u origin HEAD
gh pr create --title "Tarayıcı eklentisi: ilan sayfasından tek tıkla uyum analizi (DOG-70)" --body "<özet, test sonuçları, elle doğrulama ekran görüntüleri>"
```

  - Vercel SUCCESS olunca squash merge; Linear DOG-70 → Done.
