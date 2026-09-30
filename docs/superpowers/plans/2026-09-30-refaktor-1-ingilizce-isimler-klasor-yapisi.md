# Refaktör 1/3: İngilizce isimler ve özellik bazlı klasör yapısı · Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repodaki bütün kod isimlerini İngilizceye çevirmek ve `apps/web`'i özellik bazlı `src/` yapısına taşımak; kullanıcının göreceği hiçbir davranış değişmeden.

**Architecture:** İş paket paket ilerliyor: önce bağımlılığı en az olan (`db`, `worker`), sonra `core`, en son `web`. Her görev kendi başına derlenir ve bütün testleri geçer. Kalıcı olarak saklanan üç Türkçe anahtarlı yapı (biçim raporu, ön yazı, tarayıcıdaki aktif analiz) için veri geçişi yazılıyor. Web, core'un tiplerini kopyalamak yerine doğrudan import ediyor; bir anahtar değişirse TypeScript yakalar.

**Tech Stack:** pnpm monorepo, Next.js 15 (App Router), TypeScript, Prisma 5, BullMQ, Vitest.

**Spec:** Linear DOG-39 (https://linear.app/doganay-balaban/issue/DOG-39) ve kullanıcının 30 Eylül 2026 kararları: kapsam tüm repo, yorumlar Türkçe, iş üç PR'da, klasör yapısı özellik bazlı.

## Global Constraints

- İngilizce olacaklar: dosya ve klasör adları, fonksiyon, değişken, parametre, tip, arayüz, bileşen, sabit, CSS module sınıf adları, test açıklamaları (`describe`/`it` metinleri).
- Türkçe kalacaklar: kod yorumları, kullanıcıya görünen bütün metinler, `docs/` altındaki belgeler, LLM prompt'ları (modele giden metin bir kullanıcı metnidir).
- Değişmeyecekler: URL yolları (`/analyze`, `/api/adapt/[id]/download` …), Prisma model ve alan adları, ortam değişkeni adları, kuyruk adları ve iş verisi alanları, `package.json` paket adları (`@uyarla/*`).
- Veritabanındaki mevcut kayıtlar ve tarayıcıdaki mevcut aktif analiz kaydı refaktörden sonra da okunabilmeli.
- Her görevin sonunda: `pnpm -r typecheck` temiz, `pnpm -r test` bütün testler geçiyor, test sayısı düşmemiş.
- `packages/core` görevinden sonra `pnpm --filter @uyarla/core eval` taban çizgisiyle birebir aynı: isabet %94,6, kaçırma 2, uydurma 1, eşleşme kaynağı kelime 13 · anlamsal 7.
- Kod stili mevcut dosyalarla aynı: noktalı virgül yok, çift tırnak, 2 boşluk girinti, satır ~110 karakter. **Prettier çalıştırma**: projede yapılandırması yok, varsayılanlarla bütün dosyayı yeniden biçimlendiriyor.
- Dosya taşımaları `git mv` ile yapılır ki geçmiş izlenebilsin.

## Review Focus

1. **Refaktörden önce yapılmış bir analiz açılıyor.** Biçim raporu ve ön yazı eksiksiz görünmeli. Veritabanındaki eski anahtarlar geçiş betiğiyle taşınıyor; Görev 4'teki testler dönüştürücüyü, Görev 10'daki adım gerçek geliştirme veritabanını doğruluyor.
2. **Tarayıcıda süren bir analiz varken site güncelleniyor.** Sağ alttaki bildirim kaybolmamalı. Görev 9'daki test eski `uyarla:aktif-analiz` kaydının yeni anahtara taşındığını sınıyor.
3. **Web ile core arasında sessiz anahtar uyuşmazlığı.** Web bugün biçim raporu ve ön yazı için kendi kopyaladığı tipleri kullanıyor; core'da anahtar değişince TypeScript uyarmıyor ve ekran boş kalıyor. Görev 3'te web bu tipleri `@uyarla/core`'dan import edecek; Görev 3'ün adımı, yanlış bir anahtarın derlemeyi kırdığını doğruluyor.
4. **Kuyrukta bekleyen işler.** Web'in kuyruğa koyduğu iş verisini worker okuyor. İki taraf farklı zamanda güncellenirse iş düşer. Kuyruk adları ve iş verisi alanları zaten İngilizce ve değişmiyor; Görev 2'deki adım bunu bir tip testine bağlıyor.
5. **Route group taşıması bir adresi değiştiriyor.** `(uygulama)` → `(app)` gibi taşımalar URL'yi değiştirmemeli. Görev 8, taşımadan önce ve sonra route listesini karşılaştırıyor.

## İsim Sözlüğü

Aynı kavram her yerde aynı İngilizce adı alır. Aşağıdaki listede olmayan bir kelime çıkarsa buraya eklenir, sonra kullanılır.

| Türkçe | İngilizce | Türkçe | İngilizce |
|---|---|---|---|
| analiz | analysis | ilan | posting (tip/değişken), job (kuyruk ve API adlarında olduğu gibi) |
| aktif analiz | active analysis | kanıt | evidence |
| aşama | stage | kavram | concept |
| başlık | heading (belge) / title (sayfa) | kayıt | record |
| başvuru panosu / pano | application board / board | kayıtlı (kullanıcı) | registered |
| beceri | skill | kelime | keyword (skor) / word (metin) |
| bekleyen | pending | madde | bullet |
| biçim raporu | format report | metin | text |
| bulgu | finding | oturum | session |
| bölüm | section | ön yazı | cover letter |
| çıkarım | extraction | özet | summary |
| deneyim | experience | sağlayıcı | provider |
| devralma | claim (anonim veriyi hesaba taşıma) | satır | line |
| dönüş (adresi) | return path | seviye | severity |
| durum | status | silme | deletion |
| eğitim | education | skor | score |
| eşik | threshold | sonuç | result |
| eşleşme | match | temizlik | cleanup |
| gereksinim | requirement | uyarı | warning |
| giriş | login / sign-in | uyarlama | adaptation |
| görsel | visual / image | uydurma | fabrication |
| hata | error | yasal | legal |
| isabet | accuracy | yazım | rewrite |

Kalıcı anahtarların eşlemesi (Görev 3 ve 4 bunlara bağlı):

| Yapı | Eski | Yeni |
|---|---|---|
| `Analysis.result.format` | `bulgular`, `gecenler` | `findings`, `passed` |
| biçim bulgusu | `kod`, `seviye`, `baslik`, `aciklama` | `code`, `severity`, `title`, `description` |
| bulgu seviyesi değerleri | `"sorun"`, `"uyari"` | `"problem"`, `"warning"` |
| biçim ölçümleri | `gorselSayisi`, `metinKutusu`, `sutunSayisi`, `tabloSayisi`, `ustAltMetin` | `imageCount`, `textBox`, `columnCount`, `tableCount`, `headerFooterText` |
| `Adaptation.coverLetter` | `paragraflar`, `metin`, `kontrol` | `paragraphs`, `text`, `verification` |
| localStorage | anahtar `uyarla:aktif-analiz` | anahtar `uyarla:active-analysis` |
| aktif analiz alanları | `baslangic`, `durum`, `asama`, `skor`, `hata`, `goruldu` | `startedAt`, `status`, `stage`, `score`, `error`, `seen` |

Bulgu kodlarının değerleri (`"metin_kutusu"` gibi) veri kimliğidir, UI'da gösterilmez; yine de İngilizceye çevrilir (`"text_box"`) ve geçiş betiği bunları da taşır. Görev 3 tam listeyi `check.ts`'teki bütün `code:` değerlerinden çıkarır.

---

### Task 0: Branch ve taban çizgisi

**Files:** yok (yalnızca ölçüm)

- [ ] **Step 1: Branch aç**

```bash
git switch main && git pull --ff-only
git switch -c refactor/english-names-feature-folders
```

- [ ] **Step 2: Taban çizgisini kaydet**

```bash
pnpm -r typecheck
pnpm -r test 2>&1 | grep -E "Tests +[0-9]+ passed" > /tmp/taban-test.txt; cat /tmp/taban-test.txt
pnpm --filter @uyarla/core eval 2>&1 | grep -E "İsabet|Kaçırma|Uydurma|Eşleşme kaynağı"
(cd apps/web && find app -name "page.tsx" -o -name "route.ts" | sed -E 's#\([^)]*\)/##g' | sort) > /tmp/taban-rotalar.txt
```

Beklenen: typecheck temiz; eval satırları `94.6%`, `2`, `1`, `kelime 13 · anlamsal 7`. Bu dört dosya görev sonlarındaki karşılaştırmaların dayanağı.

### Task 1: Ölçüm betiklerinin model başına önbelleği

Bu değişiklik `main`'de commit'lenmemiş olarak duruyor (Qwen/Gemma karşılaştırmasından). İsimlendirmeden önce olduğu gibi commit'leniyor ki Görev 5'teki yeniden adlandırma ayrı görünsün.

**Files:**
- Modify: `packages/core/eval/types.ts` (`onbellekDizini`), `prepare.ts` (süre/token kaydı), `run.ts`, `sweep.ts`, `kapsam.ts`, `uyarla.ts`

- [ ] **Step 1: Değişikliği doğrula**

```bash
git diff --stat -- packages/core/eval
pnpm --filter @uyarla/core typecheck
pnpm --filter @uyarla/core eval 2>&1 | grep "İsabet"
```
Beklenen: 6 dosya değişmiş; typecheck temiz; isabet `94.6%` (EVAL_CACHE verilmeyince öntanımlı `eval/cache` kullanılıyor).

- [ ] **Step 2: Commit**

```bash
git add packages/core/eval/*.ts
git commit -m "eval: model başına önbellek (EVAL_CACHE) ve çıkarım süre/token kaydı"
```

### Task 2: `packages/db` ve `apps/worker`

Worker'ın export'ları zaten İngilizce; iş, fonksiyon gövdelerindeki Türkçe yerel adlar.

**Files:**
- Modify: `apps/worker/src/*.ts` (13 dosya), `packages/db/src/index.ts`
- Test: `apps/worker/src/job-contract.test.ts` (yeni)

**Interfaces:**
- Produces: değişiklik yok; `AnalyzeJobData`, `AdaptJobData`, `ANALYZE_QUEUE`, `ADAPT_QUEUE`, `COVER_LETTER_JOB` adları ve alanları olduğu gibi.

- [ ] **Step 1: Kuyruk sözleşmesini sabitleyen testi yaz**

`apps/worker/src/job-contract.test.ts`:
```ts
import { describe, expect, expectTypeOf, it } from "vitest"
import type { AdaptJobData } from "./adapt-types"
import type { AnalyzeJobData } from "./types"
import { ADAPT_QUEUE } from "./adapt-queue"
import { ANALYZE_QUEUE } from "./queue"

/**
 * Web kuyruğa bu alanlarla iş koyuyor. Adlar değişirse, güncellenmemiş bir
 * web sürecinin koyduğu iş worker'da düşer; bu test o değişikliği görünür
 * kılıyor.
 */
describe("job contract", () => {
  it("keeps queue names", () => {
    expect(ANALYZE_QUEUE).toBe("analyze")
    expect(ADAPT_QUEUE).toBe("adapt")
  })

  it("keeps job data keys", () => {
    expectTypeOf<keyof AnalyzeJobData>().toEqualTypeOf<"analysisId">()
    expectTypeOf<keyof AdaptJobData>().toEqualTypeOf<"adaptationId">()
  })
})
```

- [ ] **Step 2: Testi çalıştır, gerçek değerleri doğrula**

Run: `pnpm --filter @uyarla/worker exec vitest run src/job-contract.test.ts`
Beklenen: PASS. FAIL olursa test yanlış değil, beklenen değerler yanlış: `queue.ts`, `adapt-queue.ts`, `types.ts`, `adapt-types.ts`'teki gerçek ad ve alanlar testteki literal'lere yazılır (davranış değil, belge güncelleniyor), test yeniden çalıştırılır ve PASS görülür.

- [ ] **Step 3: Türkçe yerel adları çevir**

Her dosyada sözlüğe göre. Bulmak için:
```bash
grep -nE "\b(const|let|function)\s+[a-z]*[çğıöşü]|\b(const|let|function)\s+(sonuc|hata|kayit|madde|ozet|sure|bekle|gorev|taslak|deneme|basla|bitti)[A-Za-z]*" apps/worker/src/*.ts packages/db/src/index.ts
```
`describe`/`it` metinleri de İngilizceye çevrilir.

- [ ] **Step 4: Doğrula**

```bash
pnpm --filter @uyarla/worker typecheck && pnpm --filter @uyarla/worker test
pnpm --filter @uyarla/db typecheck
```
Beklenen: temiz; worker test sayısı tabandakinden 2 fazla (yeni test).

- [ ] **Step 5: Commit**

```bash
git add apps/worker packages/db
git commit -m "refactor(worker,db): İngilizce isimler; kuyruk sözleşmesi testi"
```

### Task 3: `packages/core/src` ve kalıcı anahtarlar

**Files:**
- Modify: `packages/core/src/**/*.ts` (bütün dosyalar), `packages/core/src/index.ts` (export listesi)
- Modify (web tüketicileri, derlenebilsin diye): `apps/web/app/components/BicimRaporu.tsx`, `apps/web/app/components/OnYaziBolumu.tsx`, `apps/web/app/api/adapt/[id]/cover-letter/route.ts`, `apps/web/app/api/analysis/[id]/route.ts`, ve `FormatRaporuView`/`FormatBulguView`/`OnYaziKaydiView` tanımlayan bütün dosyalar

**Interfaces:**
- Produces (core export'ları, eski → yeni):
  - `Bolum` → `ResumeSection`, `bolumBasligi` → `sectionHeading`
  - `cvOlgulari` → `resumeFacts`, `dogalYazim` → `naturalSpelling`
  - `Dil` → `Language`
  - `FormatBulgu` → `FormatFinding`, `FormatRaporu` → `FormatReport`, `FormatSeviye` → `FormatSeverity`
  - `kavramGeciyor` → `mentionsConcept`, `ozelAdMi` → `isProperNoun`
  - `OnYazi` → `CoverLetter`, `OnYaziKaydi` → `CoverLetterRecord`, `OnYaziParagrafi` → `CoverLetterParagraph`
  - Anahtarlar: yukarıdaki "Kalıcı anahtarların eşlemesi" tablosu.
- Değişmeyen: diğer bütün export'lar (zaten İngilizce).

- [ ] **Step 1: Export'ları ve anahtarları yeniden adlandır**

`format/check.ts`, `cover/letter.ts` ve yukarıdaki export'ları taşıyan dosyalarda. Sonra her tüketiciyi güncelle:
```bash
grep -rnE "\b(Bolum|bolumBasligi|cvOlgulari|dogalYazim|Dil|FormatBulgu|FormatRaporu|FormatSeviye|kavramGeciyor|ozelAdMi|OnYazi|OnYaziKaydi|OnYaziParagrafi)\b" packages apps --include=*.ts --include=*.tsx
grep -rnE "\.(bulgular|gecenler|kod|seviye|baslik|aciklama|paragraflar|kontrol|gorselSayisi|metinKutusu|sutunSayisi|tabloSayisi|ustAltMetin)\b|\"(sorun|uyari)\"" packages apps --include=*.ts --include=*.tsx
```
İkinci grep'in bütün eşleşmeleri ya taşınır ya da (başka bir yapıya ait, ör. yerel değişken) bilinçli olarak bırakılır.

- [ ] **Step 2: Web'in kopya tiplerini core tiplerine bağla**

Web'de `FormatRaporuView`, `FormatBulguView` ve `OnYaziKaydiView` elle yazılmış kopyalar. Silinir, yerine:
```ts
import type { CoverLetterRecord, FormatFinding, FormatReport } from "@uyarla/core"
```
Bu dosyalar `"use client"` ise `import type` yeterli; paket istemci paketine girmez.

- [ ] **Step 3: Bağlantının işe yaradığını kanıtla**

`BicimRaporu.tsx`'te bir alanı geçici olarak eski adıyla yaz (`finding.baslik`), sonra:
Run: `pnpm --filter @uyarla/web typecheck`
Beklenen: FAIL, `Property 'baslik' does not exist on type 'FormatFinding'`. Değişikliği geri al, tekrar çalıştır: temiz.

- [ ] **Step 4: Kalan Türkçe yerel adları çevir**

`packages/core/src` altındaki her dosyada sözlüğe göre. Bu kısım en uzunu (yüzlerce yerel ad); klasör klasör ilerle ve her klasörden sonra `pnpm --filter @uyarla/core typecheck` çalıştır. `describe`/`it` metinleri de çevrilir. **LLM prompt metinleri (`prompts.ts` ve prompt'a giden şablon dizeleri) Türkçe kalır.**

- [ ] **Step 5: Doğrula**

```bash
pnpm -r typecheck
pnpm -r test
pnpm --filter @uyarla/core eval 2>&1 | grep -E "İsabet|Kaçırma|Uydurma|Eşleşme kaynağı"
```
Beklenen: temiz; test sayıları tabanla aynı (+2 worker); eval dört satırı tabanla birebir aynı. Tek bir sayı farklıysa bir yeniden adlandırma davranışı değiştirmiştir; farkı bulmadan ilerleme.

- [ ] **Step 6: Commit**

```bash
git add packages/core apps/web
git commit -m "refactor(core): İngilizce isimler; biçim raporu ve ön yazı anahtarları; web core tiplerini kullanıyor"
```

### Task 4: Veritabanındaki eski anahtarların geçişi

Görev 3'ten sonra kod yeni anahtarları yazıyor ve okuyor; eski kayıtlar hâlâ eski anahtarlarla duruyor. Bu görev onları taşıyor. Betik anonim temizlik betiğiyle aynı düzende: öntanımlı deneme kipi, yazmak için `--apply`.

**Files:**
- Create: `apps/web/lib/legacyJsonKeys.ts` (saf dönüştürücüler; Görev 7'de `src/server/`'a taşınır)
- Create: `apps/web/lib/legacyJsonKeys.test.ts`
- Create: `apps/web/scripts/migrate-json-keys.ts`
- Modify: `apps/web/package.json` (`"migrate:json-keys"` betiği)

**Interfaces:**
- Produces: `upgradeFormatReport(value: unknown): { value: unknown; changed: boolean }`, `upgradeCoverLetter(value: unknown): { value: unknown; changed: boolean }`

- [ ] **Step 1: Testleri yaz**

`apps/web/lib/legacyJsonKeys.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { upgradeCoverLetter, upgradeFormatReport } from "./legacyJsonKeys"

describe("upgradeFormatReport", () => {
  it("renames legacy keys and severity values", () => {
    const { value, changed } = upgradeFormatReport({
      gecenler: ["Tek sütun"],
      bulgular: [{ kod: "metin_kutusu", seviye: "sorun", baslik: "Metin kutusu", aciklama: "…" }],
      gorselSayisi: 0,
      metinKutusu: true,
      sutunSayisi: 1,
      tabloSayisi: 0,
      ustAltMetin: false,
    })
    expect(changed).toBe(true)
    expect(value).toEqual({
      passed: ["Tek sütun"],
      findings: [{ code: "text_box", severity: "problem", title: "Metin kutusu", description: "…" }],
      imageCount: 0,
      textBox: true,
      columnCount: 1,
      tableCount: 0,
      headerFooterText: false,
    })
  })

  it("leaves an already upgraded report untouched", () => {
    const yeni = { passed: [], findings: [{ code: "text_box", severity: "warning", title: "t", description: "d" }] }
    expect(upgradeFormatReport(yeni)).toEqual({ value: yeni, changed: false })
  })

  it("ignores values that are not reports", () => {
    expect(upgradeFormatReport(null)).toEqual({ value: null, changed: false })
    expect(upgradeFormatReport("x")).toEqual({ value: "x", changed: false })
  })
})

describe("upgradeCoverLetter", () => {
  it("renames paragraph keys and keeps other fields", () => {
    const kontrol = { status: "ok", issues: [] }
    const { value, changed } = upgradeCoverLetter({
      status: "ready",
      paragraflar: [{ metin: "Merhaba", kontrol }],
    })
    expect(changed).toBe(true)
    expect(value).toEqual({ status: "ready", paragraphs: [{ text: "Merhaba", verification: kontrol }] })
  })

  it("leaves an already upgraded letter untouched", () => {
    const yeni = { status: "ready", paragraphs: [{ text: "a", verification: {} }] }
    expect(upgradeCoverLetter(yeni)).toEqual({ value: yeni, changed: false })
  })
})
```

Not: `status: "ready"` ve `verification` içeriği, `CoverLetterRecord`'un Görev 3 sonrası gerçek biçimine göre düzeltilir; test, o tipin bir örneğini kullanmalı.

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @uyarla/web exec vitest run lib/legacyJsonKeys.test.ts`
Beklenen: FAIL, `Cannot find module './legacyJsonKeys'`.

- [ ] **Step 3: Dönüştürücüleri yaz**

`apps/web/lib/legacyJsonKeys.ts`:
```ts
/**
 * Refaktör 1 (DOG-39) öncesi Türkçe anahtarlarla yazılmış JSON alanlarını
 * yeni anahtarlara taşır. Saf fonksiyonlar: ne okuduklarını ne yazdıklarını
 * bilmiyorlar; betik (scripts/migrate-json-keys.ts) veritabanıyla konuşuyor.
 *
 * İkinci kez çalıştırmak güvenli: yeni biçimdeki değer `changed: false` ile
 * olduğu gibi dönüyor.
 */

type Upgrade = { value: unknown; changed: boolean }

const REPORT_KEYS: Record<string, string> = {
  gecenler: "passed",
  bulgular: "findings",
  gorselSayisi: "imageCount",
  metinKutusu: "textBox",
  sutunSayisi: "columnCount",
  tabloSayisi: "tableCount",
  ustAltMetin: "headerFooterText",
}
const FINDING_KEYS: Record<string, string> = {
  kod: "code",
  seviye: "severity",
  baslik: "title",
  aciklama: "description",
}
const SEVERITY: Record<string, string> = { sorun: "problem", uyari: "warning" }
// Görev 3'te check.ts'teki bütün `code:` değerlerinden tamamlanır.
const FINDING_CODES: Record<string, string> = { metin_kutusu: "text_box" }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

function renameKeys(obj: Record<string, unknown>, map: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [map[k] ?? k, v]))
}

export function upgradeFormatReport(value: unknown): Upgrade {
  if (!isObject(value) || !Object.keys(value).some((k) => k in REPORT_KEYS)) return { value, changed: false }
  const report = renameKeys(value, REPORT_KEYS)
  if (Array.isArray(report.findings)) {
    report.findings = report.findings.map((f) => {
      if (!isObject(f)) return f
      const finding = renameKeys(f, FINDING_KEYS)
      if (typeof finding.severity === "string") finding.severity = SEVERITY[finding.severity] ?? finding.severity
      if (typeof finding.code === "string") finding.code = FINDING_CODES[finding.code] ?? finding.code
      return finding
    })
  }
  return { value: report, changed: true }
}

export function upgradeCoverLetter(value: unknown): Upgrade {
  if (!isObject(value) || !("paragraflar" in value)) return { value, changed: false }
  const { paragraflar, ...rest } = value
  const paragraphs = Array.isArray(paragraflar)
    ? paragraflar.map((p) => (isObject(p) ? renameKeys(p, { metin: "text", kontrol: "verification" }) : p))
    : paragraflar
  return { value: { ...rest, paragraphs }, changed: true }
}
```

- [ ] **Step 4: Testlerin geçtiğini gör**

Run: `pnpm --filter @uyarla/web exec vitest run lib/legacyJsonKeys.test.ts`
Beklenen: PASS (5 test).

- [ ] **Step 5: Betiği yaz**

`apps/web/scripts/migrate-json-keys.ts`:
```ts
/**
 * Eski Türkçe JSON anahtarlarını taşır (DOG-39).
 *
 *   pnpm --filter @uyarla/web migrate:json-keys          deneme: neyin değişeceğini sayar
 *   pnpm --filter @uyarla/web migrate:json-keys --apply  yazar
 */
import { prisma } from "@uyarla/db"
import { upgradeCoverLetter, upgradeFormatReport } from "../lib/legacyJsonKeys"

const apply = process.argv.includes("--apply")

async function main() {
  let analyses = 0
  for (const a of await prisma.analysis.findMany({ select: { id: true, result: true } })) {
    const result = a.result as Record<string, unknown> | null
    if (!result || !("format" in result)) continue
    const { value, changed } = upgradeFormatReport(result.format)
    if (!changed) continue
    analyses++
    if (apply) await prisma.analysis.update({ where: { id: a.id }, data: { result: { ...result, format: value } as object } })
  }

  let letters = 0
  for (const ad of await prisma.adaptation.findMany({ select: { id: true, coverLetter: true } })) {
    const { value, changed } = upgradeCoverLetter(ad.coverLetter)
    if (!changed) continue
    letters++
    if (apply) await prisma.adaptation.update({ where: { id: ad.id }, data: { coverLetter: value as object } })
  }

  console.log(`${apply ? "taşındı" : "taşınacak (deneme)"}: ${analyses} analiz, ${letters} ön yazı`)
}

main().finally(() => prisma.$disconnect())
```

`apps/web/package.json` betiklerine:
```json
"migrate:json-keys": "dotenv -e ../../.env -- tsx scripts/migrate-json-keys.ts"
```

- [ ] **Step 6: Geliştirme veritabanında çalıştır**

```bash
pnpm --filter @uyarla/web migrate:json-keys           # deneme: N analiz, M ön yazı
pnpm --filter @uyarla/web migrate:json-keys --apply
pnpm --filter @uyarla/web migrate:json-keys           # beklenen: 0 analiz, 0 ön yazı
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/legacyJsonKeys.ts apps/web/lib/legacyJsonKeys.test.ts apps/web/scripts/migrate-json-keys.ts apps/web/package.json
git commit -m "feat(web): eski Türkçe JSON anahtarlarının geçiş betiği"
```

### Task 5: `packages/core/eval`

**Files:**
- Rename: `kapsam.ts` → `coverage.ts`, `karsilastir.ts` → `segment-compare.ts`, `uyarla.ts` → `adapt.ts` (`prepare.ts`, `run.ts`, `sweep.ts`, `compare.ts`, `types.ts` adları kalır)
- Modify: `packages/core/package.json` betikleri; `docs/birikmis-isler.md` ve `docs/kullanilabilirlik-testi.md`'deki komut adları
- Modify: yukarıdaki bütün dosyalarda Türkçe yerel adlar (`onbellekDizini` → `cacheDir`, `SayanLlm` → `CountingLlm`, `OnbellekliLlm` → `CachingLlm`, `sureler` → `timings`, …)

- [ ] **Step 1: Taşı ve betikleri güncelle**

```bash
cd packages/core/eval
git mv kapsam.ts coverage.ts && git mv karsilastir.ts segment-compare.ts && git mv uyarla.ts adapt.ts
```
`package.json`:
```json
"eval": "dotenv -e ../../.env -- tsx eval/run.ts",
"eval:sweep": "dotenv -e ../../.env -- tsx eval/sweep.ts",
"eval:coverage": "dotenv -e ../../.env -- tsx eval/coverage.ts",
"eval:prepare": "dotenv -e ../../.env -- tsx eval/prepare.ts",
"eval:segment": "dotenv -e ../../.env -- tsx eval/segment-compare.ts",
"eval:adapt": "dotenv -e ../../.env -- tsx eval/adapt.ts"
```
`eval/cache/sureler.json` dosya adı `timings.json` olur; `prepare.ts` yeni adı yazar.

- [ ] **Step 2: Belgelerdeki komutları güncelle**

```bash
grep -rn "eval:kapsam" docs
```
Her `eval:kapsam` → `eval:coverage`. `kararlar.md`'ye dokunulmaz: tarihli karar kaydıdır, o gün hangi komut çalıştıysa o yazıyor.

- [ ] **Step 3: Doğrula**

```bash
pnpm --filter @uyarla/core typecheck && pnpm --filter @uyarla/core test
pnpm --filter @uyarla/core eval 2>&1 | grep -E "İsabet|Kaçırma|Uydurma"
pnpm --filter @uyarla/core eval:coverage 2>&1 | tail -5
```
Beklenen: temiz; eval tabanla aynı; coverage hatasız biter.

- [ ] **Step 4: Commit**

```bash
git add -A packages/core docs
git commit -m "refactor(eval): İngilizce dosya ve betik adları"
```

### Task 6: `apps/web` → `src/` (yalnızca taşıma)

İçerik ve isim değişmiyor; yalnızca konum. Böylece Görev 7 ve 8'in diff'leri okunur kalıyor.

**Files:**
- Move: `apps/web/app` → `apps/web/src/app`, `apps/web/lib` → `apps/web/src/lib`
- Modify: `apps/web/tsconfig.json`, `apps/web/vitest.config.ts`, `apps/web/vitest.integration.config.ts`, `apps/web/scripts/*.ts` (göreli import'lar), `apps/web/next.config.mjs` (yorumdaki yol)

- [ ] **Step 1: Taşı**

```bash
cd apps/web && mkdir src && git mv app src/app && git mv lib src/lib
```

- [ ] **Step 2: Yapılandırmaları güncelle**

`tsconfig.json`: `"@/*": ["./src/*"]`
`vitest.config.ts`: `include: ["src/**/*.test.ts"]`, `exclude: ["src/**/*.integration.test.ts", "node_modules/**"]`
`vitest.integration.config.ts`: `include: ["src/**/*.integration.test.ts"]`
`scripts/*.ts`: `../lib/...` → `../src/lib/...`

- [ ] **Step 3: Doğrula**

```bash
pnpm --filter @uyarla/web typecheck && pnpm --filter @uyarla/web test
(find src/app -name "page.tsx" -o -name "route.ts" | sed -E 's#^src/##; s#\([^)]*\)/##g' | sort) | diff /tmp/taban-rotalar.txt -
```
Beklenen: temiz; rota listesi farksız. Dev sunucusu yeniden başlatılıp `/` ve `/analyze` açılır (Next `src/app`'i kendisi buluyor).

- [ ] **Step 4: Commit**

```bash
git add -A apps/web && git commit -m "refactor(web): kaynakları src/ altına taşı"
```

### Task 7: `src/lib` → `server/`, `lib/`, `features/*`

**Files (eski → yeni, testleri yanlarında taşınır):**

| Eski (`src/lib/`) | Yeni |
|---|---|
| `auth.ts` | `src/server/auth.ts` |
| `authz.ts` (+ testler) | `src/server/authz.ts` |
| `queue.ts` | `src/server/queue.ts` |
| `adaptQueue.ts` | `src/server/adaptQueue.ts` |
| `redis.ts` | `src/server/redis.ts` |
| `mail.ts` (+ test) | `src/server/mail.ts` |
| `upload.ts` (+ test) | `src/server/upload.ts` |
| `rateLimit.ts` (+ test) | `src/server/rateLimit.ts` |
| `devral.ts` (+ testler) | `src/server/claimAnonymousData.ts` |
| `silme.ts` (+ testler) | `src/server/deleteAccount.ts` |
| `temizlik.ts` (+ testler) | `src/server/cleanupAnonymousUsers.ts` |
| `adaptation.ts` (+ test) | `src/server/adaptationDecision.ts` |
| `hataMesaji.ts` (+ test) | `src/server/analysisErrorMessage.ts` |
| `ilanBaglantisi.ts` (+ test) | `src/server/jobPostingFromUrl.ts` |
| `legacyJsonKeys.ts` (+ test) | `src/server/legacyJsonKeys.ts` |
| `cn.ts` | `src/lib/cn.ts` |
| `site.ts` | `src/lib/site.ts` |
| `authClient.ts` | `src/lib/authClient.ts` |
| `donus.ts` (+ test) | `src/lib/returnPath.ts` |
| `skor.ts` | `src/lib/scoreStatus.ts` |
| `aktifAnaliz.ts` (+ test) | `src/features/analysis/activeAnalysis.ts` |
| `asamalar.ts` (+ test) | `src/features/analysis/stageStates.ts` |
| `diff.ts` (+ test) | `src/features/adaptation/diff.ts` |
| `pano.ts` (+ test) | `src/features/applications/board.ts` |
| `dashboard.ts` (+ test) | `src/features/dashboard/summary.ts` |
| `saglayicilar.ts` (+ test) | `src/features/auth/providers.ts` |
| `eposta.ts` (+ test) | `src/features/auth/emailHints.ts` |
| `yasal.ts` | `src/features/legal/company.ts` |

**Interfaces (export'lar, eski → yeni):**
- returnPath: `girisAdresi` → `loginPath`, `girisHataAdresi` → `loginErrorPath`, `guvenliDonus` → `safeReturnPath`, `VARSAYILAN_DONUS` → `DEFAULT_RETURN_PATH`, `izinliAdres` → `isAllowedPath`, `IZINLI_ALANLAR` → `ALLOWED_PREFIXES`
- scoreStatus: `skorDurumu` → `scoreStatus` (dönüş: `{ label, textClass, strokeClass, bgClass }`)
- activeAnalysis: `AktifAnaliz` → `ActiveAnalysis`, `AktifAnalizDurumu` → `ActiveAnalysisStatus`, `aktifAnaliziBaslat` → `startActiveAnalysis`, `aktifAnaliziGuncelle` → `updateActiveAnalysis`, `aktifAnaliziOku` → `readActiveAnalysis`, `aktifAnaliziTemizle` → `clearActiveAnalysis`, `AKTIF_ANALIZ_OLAYI` → `ACTIVE_ANALYSIS_EVENT`, `sonucAdresi` → `resultPath`
- stageStates: `AsamaDurumu` → `StageState`, `asamalariTuret` → `deriveStageStates`
- board: `Asama` → `Stage`, `ASAMALAR` → `STAGES`, `ASAMA_ETIKETI` → `STAGE_LABEL`, `ASAMA_KISA` → `STAGE_SHORT_LABEL`, `ASAMA_RENGI` → `STAGE_COLOR`, `gecerliAsama` → `isStage`, `NOT_UZUNLUGU` → `NOTE_MAX_LENGTH`, `PanoKarti` → `BoardCard`, `PanoSatiri` → `BoardRow`, `PANO_SECIMI` → `BOARD_SELECT`, `panoKarti` → `toBoardCard`, `pozisyonAdi` → `positionName`, `sutunlaraDagit` → `groupByStage`, `nextStatus` kalır
- summary: `ozetle` → `summarize`, `DashboardOzeti` → `DashboardSummary`, `Bekleyen` → `PendingItem`, `BekleyenTuru` → `PendingKind` (`"karar" | "hazir" | "uyarla"` → `"decide" | "ready" | "adapt"`)
- providers: `Saglayici` → `Provider`, `SAGLAYICILAR` → `PROVIDERS`, `acikSaglayicilar` → `enabledProviders`, `saglayiciAyarlari` → `providerSettings`
- emailHints: `epostaOnerisi` → `suggestEmail`, `postaUygulamasi` → `mailAppFor`
- legal: `YASAL` → `LEGAL`
- claimAnonymousData: `devralmaIslemleri` → `claimOperations`
- deleteAccount: `silmeIslemleri` → `deletionOperations`, `SILME_SIRASI` → `DELETION_ORDER`, `SilmeSonucu` → `DeletionResult`, `kullanicilariSil` → `deleteUsers`, `dosyalariSil` → `deleteFiles`, `depoDizini` → `storageDir`, `depoIcindeMi` → `isInsideStorage`
- cleanupAnonymousUsers: `temizlikYap` → `cleanupAnonymousUsers`, `TemizlikSecenekleri` → `CleanupOptions`, `TemizlikSonucu` → `CleanupResult`, `TEMIZLIK_GUN` → `RETENTION_DAYS`, `AnonimKosulu`/`eskiAnonimKosulu` → `anonymousWhere`/`staleAnonymousWhere`, `kesimTarihi` → `cutoffDate`
- analysisErrorMessage: `analizHataMesaji` → `analysisErrorMessage`, `GECICI_HATA_MESAJI` → `TRANSIENT_ERROR_MESSAGE`
- jobPostingFromUrl: `ilanMetniCikar` → `extractPostingText`, `CikanIlan` → `ExtractedPosting`, `htmlMetin` → `htmlToText`, `yanitiIsle` → `handleResponse`
- upload: `DosyaSonucu` → `UploadResult`
- rateLimit: `RateLimitKural` → `RateLimitRule`
- authz: `Oturum` → `Session`
- diğerleri zaten İngilizce (`getSession`, `ensureOwner`, `applyDecision`, `computeScoreAfter`, `diffWords` …)

`apps/web/scripts/temizlik.ts` → `apps/web/scripts/cleanup-anonymous-users.ts`; `package.json`'da `"temizlik"` betiği → `"cleanup:anonymous"`; `docs/birikmis-isler.md` madde 13'teki komut güncellenir.

- [ ] **Step 1: Dosyaları `git mv` ile taşı** (tablodaki her satır, testleriyle birlikte)
- [ ] **Step 2: Export'ları Interfaces listesine göre yeniden adlandır, dosya içindeki Türkçe yerel adları sözlüğe göre çevir**
- [ ] **Step 3: Bütün import'ları güncelle**

```bash
grep -rn "@/lib/" src scripts | grep -vE "@/lib/(cn|site|authClient|returnPath|scoreStatus)\""
```
Beklenen: boş (kalan her `@/lib/` yeni `lib`'deki beş dosyadan birine gidiyor).

- [ ] **Step 4: Doğrula**

```bash
pnpm --filter @uyarla/web typecheck && pnpm --filter @uyarla/web test
pnpm --filter @uyarla/web test:integration
```
Beklenen: temiz; birim test sayısı Görev 4 sonrasıyla aynı; entegrasyon testleri geçiyor (Postgres açık olmalı).

- [ ] **Step 5: Commit**

```bash
git add -A apps/web docs && git commit -m "refactor(web): lib'i server/, lib/ ve features/ altına ayır; İngilizce isimler"
```

### Task 8: Bileşenler, route'lar ve CSS

**Files (eski → yeni):**

| Eski (`src/app/`) | Yeni |
|---|---|
| `components/Navbar.tsx` | `src/components/layout/Navbar.tsx` |
| `components/Sayfa.tsx` | `src/components/layout/PageShell.tsx` (`SayfaKabi` → `PageShell`, `SayfaBasligi` → `PageHeader`, `KAP` → `CONTAINER`, `SayfaGenisligi` → `PageWidth`: `"genis"/"orta"/"dar"` → `"wide"/"medium"/"narrow"`) |
| `components/Logo.tsx` | `src/components/layout/Logo.tsx` |
| `components/YasalSayfa.tsx` | `src/features/legal/LegalPage.tsx` |
| `components/AnalizBildirimi.tsx` | `src/features/analysis/components/AnalysisNotice.tsx` |
| `components/BicimRaporu.tsx` | `src/features/analysis/components/FormatReport.tsx` |
| `components/SkorSonucu.tsx` | `src/features/analysis/components/ScoreResult.tsx` |
| `components/ui/SkorHalkasi.tsx` | `src/features/analysis/components/ScoreRing.tsx` |
| `components/ui/AsamaCizelgesi.tsx` | `src/features/analysis/components/StageTimeline.tsx` |
| `components/ui/CvYukleme.tsx` | `src/features/analysis/components/ResumeUpload.tsx` |
| `components/OnYaziBolumu.tsx` | `src/features/adaptation/components/CoverLetterSection.tsx` |
| `applications/Pano.tsx` | `src/features/applications/components/ApplicationBoard.tsx` |
| `login/GirisFormu.tsx` | `src/features/auth/components/LoginForm.tsx` |
| `login/GirisGorseli.tsx` | `src/features/auth/components/LoginVisual.tsx` |
| `login/SosyalGiris.tsx` | `src/features/auth/components/SocialLogin.tsx` |
| `components/landing/Foto.tsx` | `src/features/landing/components/Photo.tsx` |
| `components/landing/FotoYeri.tsx` | `src/features/landing/components/PhotoPlaceholder.tsx` |
| `components/landing/Ikon.tsx` | `src/features/landing/components/Icon.tsx` |
| `components/landing/Mockuplar.tsx` | `src/features/landing/components/Mockups.tsx` |
| `components/landing/landing.module.css` | `src/features/landing/landing.module.css` |

Route'lar (URL'ler değişmez):

| Eski (`src/app/`) | Yeni (`src/app/`) | Sayfanın gövdesi |
|---|---|---|
| `page.tsx` | `(marketing)/page.tsx` | `src/features/landing/LandingPage.tsx` (içerik dizileri `src/features/landing/content.ts`) |
| `privacy/page.tsx`, `terms/page.tsx` | `(marketing)/privacy/…`, `(marketing)/terms/…` | yerinde (metin sayfası) |
| `login/page.tsx` | `(auth)/login/page.tsx` | `LoginForm` |
| `dashboard/page.tsx` | `(app)/dashboard/page.tsx` | sorgu `src/server/dashboard.ts` → `getDashboardData(userId)`; bileşenler `src/features/dashboard/components/{PendingList,RecentAnalyses,ApplicationStages}.tsx` |
| `applications/page.tsx` | `(app)/applications/page.tsx` | `ApplicationBoard` |
| `(uygulama)/layout.tsx` | `(app)/(focused)/layout.tsx` | `PageShell width="medium"` |
| `(uygulama)/analyze/page.tsx` | `(app)/(focused)/analyze/page.tsx` | `src/features/analysis/components/AnalyzeView.tsx` |
| `(uygulama)/adapt/[id]/page.tsx` | `(app)/(focused)/adapt/[id]/page.tsx` | `src/features/adaptation/components/AdaptationView.tsx` |
| `(uygulama)/account/page.tsx` | `(app)/(focused)/account/page.tsx` | `src/features/account/components/AccountView.tsx` |
| `(uygulama)/test/page.tsx` | `(app)/(focused)/test/page.tsx` | yerinde (yönlendirme) |

Kökte kalanlar: `layout.tsx`, `globals.css`, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `opengraph-image.tsx`, `robots.ts`, `sitemap.ts`, `icon.svg`, `api/**`.

CSS: `landing.module.css`'teki bütün sınıf adları İngilizce (`kap` → `container`, `btnBirincil` → `buttonPrimary`, `sorunMetin` → `problemText`, `pencere` → `window`, `heroKontrol` → `heroCheck` …); bileşenlerdeki `s.x` kullanımları birlikte değişir. `globals.css`'teki Tailwind tema adları (`--color-mavi`, `bg-zemin`, `rounded-buton` …) da İngilizce olur: `mavi` → `blue`, `gece` → `night`, `buz` → `ice`, `mercan` → `coral`, `yesil` → `green`, `kehribar` → `amber`, `kirmizi` → `red`, `zemin` → `surface`, `metin` → `text`, `kart` → `card`, `cizgi` → `border`, `gri` → `muted`, `buton`/`kart` yarıçapları → `radius-button`/`radius-card`, `font-baslik`/`font-govde` → `font-heading`/`font-body`. Tailwind'in kendi `blue`/`green`/`red`/`amber` paletiyle çakışmasın diye marka renkleri `brand-*` önekini alır: `bg-brand-blue`, `text-brand-green` …

- [ ] **Step 1: Taşımadan önce rota listesini al** (Görev 6'daki komut, çıktı `/tmp/rotalar-oncesi.txt`)
- [ ] **Step 2: Bileşenleri ve route'ları tablolara göre `git mv` ile taşı; sayfa gövdelerini `features/*`'a çıkar, route dosyası yalnızca veri/oturum ve bileşeni çağırır**
- [ ] **Step 3: Bileşen, prop ve yerel adları sözlüğe göre çevir; CSS sınıf ve tema adlarını yeniden adlandır**

Tema adları için sınıf kullanımlarını bulmak:
```bash
grep -rnoE "\b(bg|text|border|stroke|fill|from|to|via|ring|shadow|divide|outline|decoration)-(mavi|gece|buz|mercan|yesil|kehribar|kirmizi|zemin|metin|kart|cizgi|gri)\b|rounded-(buton|kart)|font-(baslik|govde)" src | wc -l
```
Beklenen: taşımadan sonra 0.

- [ ] **Step 4: Rota listesinin değişmediğini doğrula**

```bash
(find src/app -name "page.tsx" -o -name "route.ts" | sed -E 's#^src/##; s#\([^)]*\)/##g' | sort) | diff /tmp/taban-rotalar.txt -
```
Beklenen: fark yok.

- [ ] **Step 5: Doğrula**

```bash
pnpm --filter @uyarla/web typecheck && pnpm --filter @uyarla/web test
grep -rnE "\b(const|let|function)\s+[a-zA-Z]*[çğıöşüÇĞİÖŞÜ]" src scripts
```
Beklenen: temiz; son grep boş.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web && git commit -m "refactor(web): özellik bazlı bileşen ve route yapısı; İngilizce bileşen, CSS ve tema adları"
```

### Task 9: Tarayıcıdaki aktif analiz kaydının geçişi

**Files:**
- Modify: `src/features/analysis/activeAnalysis.ts`
- Test: `src/features/analysis/activeAnalysis.test.ts`

**Interfaces:**
- Consumes: Görev 7'deki `ActiveAnalysis` tipi (alanlar: `jobId`, `analysisId?`, `startedAt`, `status`, `stage?`, `score?`, `error?`, `seen?`)
- Produces: `readActiveAnalysis()` eski anahtarı bir kez okuyup yeni anahtara yazar ve eskisini siler.

- [ ] **Step 1: Testi yaz**

`activeAnalysis.test.ts`'e (dosyanın mevcut `localStorage` sahtesini kullanarak):
```ts
it("upgrades a record saved under the legacy key", () => {
  localStorage.setItem(
    "uyarla:aktif-analiz",
    JSON.stringify({ jobId: "j1", baslangic: 1000, durum: "completed", analysisId: "a1", skor: 47, goruldu: false }),
  )
  expect(readActiveAnalysis()).toEqual({
    jobId: "j1",
    startedAt: 1000,
    status: "completed",
    analysisId: "a1",
    score: 47,
    seen: false,
  })
  expect(localStorage.getItem("uyarla:aktif-analiz")).toBeNull()
  expect(JSON.parse(localStorage.getItem("uyarla:active-analysis")!)).toMatchObject({ jobId: "j1", status: "completed" })
})
```
`durum` değerleri (`"running" | "completed" | "failed"` ya da Türkçe karşılıkları) Görev 7 öncesi `aktifAnaliz.ts`'teki `AktifAnalizDurumu`'na göre yazılır; Türkçe değer varsa eşleme tablosu testte ve kodda aynı olur.

- [ ] **Step 2: Başarısız olduğunu gör**

Run: `pnpm --filter @uyarla/web exec vitest run src/features/analysis/activeAnalysis.test.ts`
Beklenen: FAIL, `readActiveAnalysis()` `null` dönüyor.

- [ ] **Step 3: Geçişi yaz**

`activeAnalysis.ts`:
```ts
const KEY = "uyarla:active-analysis"
// Refaktör 1 (DOG-39) öncesi anahtar ve alan adları. Bir kez okunup taşınıyor.
const LEGACY_KEY = "uyarla:aktif-analiz"
const LEGACY_FIELDS: Record<string, keyof ActiveAnalysis> = {
  baslangic: "startedAt",
  durum: "status",
  asama: "stage",
  skor: "score",
  hata: "error",
  goruldu: "seen",
}

function upgradeLegacy(): void {
  const raw = window.localStorage.getItem(LEGACY_KEY)
  if (raw === null) return
  window.localStorage.removeItem(LEGACY_KEY)
  try {
    const old = JSON.parse(raw) as Record<string, unknown>
    const record = Object.fromEntries(Object.entries(old).map(([k, v]) => [LEGACY_FIELDS[k] ?? k, v]))
    window.localStorage.setItem(KEY, JSON.stringify(record))
  } catch {
    // Bozuk eski kayıt: taşınacak bir şey yok.
  }
}
```
`readActiveAnalysis()` gövdesinin başında `upgradeLegacy()` çağrılır (mevcut `try` bloğu içinde, localStorage erişilemezse sessiz kalsın).

- [ ] **Step 4: Testin geçtiğini gör**

Run: `pnpm --filter @uyarla/web exec vitest run src/features/analysis/activeAnalysis.test.ts`
Beklenen: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/analysis && git commit -m "feat(web): aktif analiz kaydını yeni anahtara taşı"
```

### Task 10: Uçtan uca doğrulama, belgeler, PR

**Files:**
- Modify: `docs/birikmis-isler.md` (açık maddelerdeki dosya yolları: `lib/silme.ts` → `src/server/deleteAccount.ts` vb.), `/Users/doganaybalaban/.claude/projects/-Users-doganaybalaban-Desktop-uyarla/memory/kod-kurallari.md` (klasör yapısı gerçekleşti)

- [ ] **Step 1: Bütün kontroller**

```bash
pnpm -r typecheck
pnpm -r test
pnpm --filter @uyarla/web test:integration
pnpm --filter @uyarla/core test:integration
pnpm --filter @uyarla/core eval 2>&1 | grep -E "İsabet|Kaçırma|Uydurma|Eşleşme kaynağı"
grep -rnE "\b(const|let|function|interface|type|class)\s+[A-Za-z_]*[çğıöşüÇĞİÖŞÜ]" apps packages --include=*.ts --include=*.tsx | grep -v node_modules
```
Beklenen: hepsi temiz/geçiyor; eval tabanla birebir; son grep boş.

- [ ] **Step 2: Ekran kontrolü**

Dev sunucusu ve worker yeniden başlatılır. Geçici oturum betiğiyle (test hesabı `huni@ornek.com`, oturum iş bitince silinir) şu ekranların görüntüsü alınır ve önceki görüntülerle karşılaştırılır: `/`, `/dashboard` (masaüstü + 390 px), hesap menüsü açık, `/applications`, `/analyze`, `/account`, `/privacy`, 404, ziyaretçi olarak `/`. Beklenen: görsel fark yok.

- [ ] **Step 3: Eski kayıtla uçtan uca**

Görev 4 geçişinden önce oluşmuş, biçim raporu olan bir analiz (`huni@ornek.com`'un analizi) `/analyze?analiz=<id>` ile açılır: biçim raporu bölümü dolu. Ön yazısı olan bir uyarlama varsa `/adapt/<id>` açılır: ön yazı paragrafları görünüyor.

- [ ] **Step 4: Yeni kayıtla uçtan uca**

LM Studio'da Gemma yüklü, worker açık: `/analyze`'da `eval/sources` içindeki bir CV ve ilanla yeni analiz; sonuç ekranı, sağ alt bildirim, uyarlama ekranı ve PDF indirme çalışıyor.

- [ ] **Step 5: Belgeleri güncelle, commit, PR**

```bash
git add -A docs && git commit -m "docs: yeni dosya yolları ve komut adları"
git push -u origin refactor/english-names-feature-folders
gh pr create --base main --title "Refaktör 1/3: İngilizce isimler ve özellik bazlı klasör yapısı"
```
PR açıklaması: kapsam, veri geçişi komutu (`pnpm --filter @uyarla/web migrate:json-keys --apply`, dağıtımdan sonra bir kez), doğrulama sonuçları, Linear DOG-39. Linear'da DOG-39 → In Review, PR bağlantısıyla.
