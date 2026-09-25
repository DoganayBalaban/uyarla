# Sprint 2 — Uyarlama Akışı ve Çıktı · Implementasyon Planı

> **Ajan çalışanlar için:** GEREKLİ ALT-SKILL: Bu planı görev görev uygulamak
> için `superpowers:subagent-driven-development` (önerilen) veya
> `superpowers:executing-plans` kullanın. Adımlar takip için checkbox
> (`- [ ]`) sözdizimi kullanır.

**Hedef:** Kullanıcının CV'sini ilana göre yeniden ifade etmek ve ATS dostu
bir belge olarak indirilebilir hâle getirmek — hiçbir şey uydurmadan.

**Mimari:** Yeniden yazma madde başına ayrı LLM çağrısıyla yapılır; beceri
sıralaması ve uydurma kontrolü kodda. Uyarlama bir çalışma belgesi olarak
yaşar (`Adaptation.draft`), kullanıcı kararlarıyla güncellenir, indirme
anında kabul edilenlerden nihai belge üretilir. Belge üretimi tek bir ara
yapıdan (`DocumentModel`) iki üreteçle: `pdfkit` ve `docx`.

**Teknoloji:** Mevcut yığın (TypeScript, Next.js 15, Prisma, BullMQ, Zod 4,
Vitest) + `pdfkit` + `docx`.

**Spec:** `docs/superpowers/specs/2026-09-25-sprint-2-uyarlama-design.md`

## Genel Kısıtlar

Bu bölüm her görevin gereksinimlerine örtük olarak dahildir.

- **Sprint 1'in tüm kısıtları geçerli:** pnpm çalışma alanı, TypeScript
  `strict`, Vitest, `packages/core` framework'süz ve Prisma'sız, model adı
  yalnızca `.env`'de (K-03), `any` yok.
- **Modelden yorum istenmez, transkripsiyon istenir; yorum kodda yapılır.**
  Sprint 1'de bu ders dört kez öğrenildi (K-11, K-18, K-19, K-22). Yeni bir
  LLM çağrısı eklemeden önce işin deterministik olup olmadığı sorulur.
- **Uydurma kontrolünün üç kuralı** (spec §7): sayı kontrolü, ilan terimi
  enjeksiyonu, anlamsal sapma. İlk ikisi kesin, üçüncüsü ikincil.
- **Anlamsal sapma eşiği başlangıç değeri `0.75`** — Görev 14'te
  değerlendirme setiyle ayarlanacak.
- **Beceri kümesi değişmez:** sıralanır, eklenmez, silinmez (K-27).
- **Eğitim, diller ve sertifikalar hiç değiştirilmez** (spec §6.4).
- **Kullanıcıya görünen tüm metinler Türkçe**, marka rehberi §6 tonunda:
  "sen" diliyle, kısa cümle, önce sonuç, suçlamayan hata mesajı.
- **CV çıktılarında marka fontu kullanılmaz** (marka rehberi §9.3, spec §9):
  PDF'te Helvetica, DOCX'te Calibri.
- **Testler ve kod yorumları Türkçe.** Mevcut kod tabanının dili bu.
- **Her görev testle biter ve commit'lenir.** Commit mesajları Türkçe,
  `feat:` / `fix:` / `test:` / `chore:` önekiyle.

---

## Dosya Yapısı

### `packages/core` — alan mantığı

| Dosya | Sorumluluk |
|---|---|
| `src/schemas/adaptation.ts` | Uyarlama çalışma belgesinin Zod şeması ve tipleri |
| `src/adapt/skills.ts` | Beceri sıralaması (saf kod) |
| `src/adapt/prompts.ts` | Özet ve madde yeniden yazma prompt'ları |
| `src/adapt/rewrite.ts` | Özet ve madde yeniden yazımı (LLM) |
| `src/adapt/profile.ts` | Kabul edilen taslaktan profil üretimi; `bulletId` |
| `src/adapt/rescore.ts` | Uyarlama sonrası skorun yeniden hesaplanması |
| `src/verify/numbers.ts` | Sayı kontrolü |
| `src/verify/injection.ts` | İlan terimi enjeksiyonu kontrolü |
| `src/verify/drift.ts` | Anlamsal sapma kontrolü |
| `src/verify/verify.ts` | Üç kontrolü birleştiren doğrulayıcı ve eşik ayarı |
| `src/document/model.ts` | `DocumentModel` — yerleşimden bağımsız ara yapı |
| `src/document/pdf.ts` | `pdfkit` üreteci |
| `src/document/docx.ts` | `docx` üreteci |
| `eval/uyarla.ts` | Uyarlama değerlendirme koşusu |

### `apps/worker` — ağır iş

| Dosya | Sorumluluk |
|---|---|
| `src/adapt-types.ts` | `AdaptationStore` portu ve hat bağımlılıkları |
| `src/adapt-pipeline.ts` | `adapt` işinin aşama sırası |
| `src/adapt-store.ts` | Uyarlamanın Prisma kalıcılığı |
| `src/adapt-queue.ts` | Kuyruk adı, iş verisi, iş seçenekleri |
| `src/index.ts` | İki kuyruğu birden dinleyen işçi |

### `apps/web` — HTTP ve arayüz

| Dosya | Sorumluluk |
|---|---|
| `lib/adaptQueue.ts` | `adapt` kuyruğunun üretici tarafı |
| `app/api/adapt/route.ts` | Uyarlama başlatma |
| `app/api/adapt/[id]/route.ts` | Durum ve çalışma belgesi |
| `app/api/adapt/[id]/decision/route.ts` | Madde kararı |
| `app/api/adapt/[id]/download/route.ts` | PDF / DOCX indirme |
| `app/adapt/[id]/page.tsx` | Uyarlama ekranı |
| `app/globals.css` | Marka değişkenleri ve bileşen stilleri |

### `packages/db`

| Dosya | Sorumluluk |
|---|---|
| `prisma/schema.prisma` | `Adaptation` modeli ve `AdaptationStatus` |

---

## Görev Sırası

Sıralama TDD'ye göre: saf fonksiyonlar önce, onları birleştiren hat sonra,
arayüz en son. Böylece her görev kendi testiyle kapanıyor ve hiçbir görev
henüz yazılmamış bir tipe referans vermiyor.

| # | Görev | Spec | Süre |
|---|---|---|---|
| 1 | `Adaptation` veri modeli ve şeması | §5 | 2 sa |
| 2 | Beceri sıralaması | §6.3 | 2 sa |
| 3 | Sayı kontrolü | §7.1 | 1,5 sa |
| 4 | İlan terimi enjeksiyonu kontrolü | §7.2 | 1,5 sa |
| 5 | Anlamsal sapma ve birleşik doğrulayıcı | §7.3 | 2 sa |
| 6 | Özet ve madde yeniden yazımı | §6.1, §6.2 | 5 sa |
| 7 | Kabul edilen taslaktan profil ve yeni skor | §10 | 1,5 sa |
| 8 | Uyarlama hattı ve kuyruk işi | §4, §13 | 4 sa |
| 9 | Belge modeli | §9 | 1,5 sa |
| 10 | PDF üreteci | §9 | 3 sa |
| 11 | DOCX üreteci | §9 | 2 sa |
| 12 | API route'ları ve indirme kapısı | §8 | 3 sa |
| 13 | Marka giydirmesi ve uyarlama ekranı | §11 | 6 sa |
| 14 | Değerlendirme setinin genişletilmesi | §12 | 3 sa |
| 15 | Kullanılabilirlik testi ve K2 kararı | §14 | 3 sa |
| | | **Toplam** | **41,5 sa** |

Görev 2–5 birbirinden bağımsız; paralel çalışılabilir. Görev 10 ve 11 de
öyle (ikisi de yalnızca Görev 9'a bağlı).

---

### Görev 1: `Adaptation` veri modeli ve şeması

Spec §5. Uyarlama bir çalışma belgesi olarak yaşıyor; bu görev onun iskeletini
kuruyor.

**Dosyalar:**
- Değiştir: `packages/db/prisma/schema.prisma`
- Oluştur: `packages/core/src/schemas/adaptation.ts`
- Test: `packages/core/src/schemas/adaptation.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Sprint 1'den `Analysis`, `ResumeVersion` modelleri.
- Üretir:
  - `VerificationSchema` (Zod), tip `Verification`
  - `AdaptedBulletSchema`, tip `AdaptedBullet`
  - `AdaptationDraftSchema`, tip `AdaptationDraft`
  - Prisma `Adaptation` modeli, `AdaptationStatus` enum'u
- Görev 5, 7, 8, 12 ve 13 bu tipleri kullanır.

- [ ] **Adım 1: Zod şemasını yaz**

`packages/core/src/schemas/adaptation.ts`:

```ts
import { z } from "zod"

/**
 * Bir yeniden yazımın uydurma kontrolünden geçip geçmediği.
 *
 * `issues` boşsa `status` "ok" olur. Her sorun kullanıcıya gösterilecek bir
 * gerekçe taşır: "Bu maddede Kubernetes geçiyor ama CV'nde yok" (spec §7.4).
 */
export const VerificationIssueSchema = z.object({
  kind: z.enum(["number_mismatch", "posting_term_injected", "semantic_drift"]),
  /** Kullanıcıya gösterilecek gerekçe. */
  detail: z.string(),
})

export const VerificationSchema = z.object({
  status: z.enum(["ok", "flagged"]),
  issues: z.array(VerificationIssueSchema),
})

export const AdaptedSummarySchema = z.object({
  original: z.string().nullable(),
  rewritten: z.string(),
  verification: VerificationSchema,
  decision: z.enum(["accepted", "rejected"]),
})

export const AdaptedBulletSchema = z.object({
  /** Kararların adreslenmesi için kararlı kimlik. */
  id: z.string(),
  /** Hangi iş deneyiminin maddesi olduğu. */
  experienceIndex: z.number().int().nonnegative(),
  original: z.string(),
  /** Ham CV metnindeki birebir karşılık; doğrulamanın kaynağı (Sprint 1). */
  sourceRef: z.string(),
  rewritten: z.string(),
  verification: VerificationSchema,
  /**
   * "pending" yalnızca uyarı taşıyan maddelerde olur ve indirmeyi bloklar
   * (K-26).
   */
  decision: z.enum(["accepted", "rejected", "pending"]),
})

export const AdaptationDraftSchema = z.object({
  summary: AdaptedSummarySchema,
  bullets: z.array(AdaptedBulletSchema),
  /** İlana göre sıralanmış beceri listesi; küme değişmez (K-27). */
  skillOrder: z.array(z.string()),
})

export type VerificationIssue = z.infer<typeof VerificationIssueSchema>
export type Verification = z.infer<typeof VerificationSchema>
export type AdaptedSummary = z.infer<typeof AdaptedSummarySchema>
export type AdaptedBullet = z.infer<typeof AdaptedBulletSchema>
export type AdaptationDraft = z.infer<typeof AdaptationDraftSchema>

/** Uyarı taşıyan ve henüz karara bağlanmamış madde var mı. */
export function hasPendingDecisions(draft: AdaptationDraft): boolean {
  return draft.bullets.some((b) => b.decision === "pending")
}
```

- [ ] **Adım 2: Şema testini yaz**

`packages/core/src/schemas/adaptation.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { AdaptationDraftSchema, hasPendingDecisions } from "./adaptation.js"

const temizMadde = {
  id: "b1",
  experienceIndex: 0,
  original: "React ile panel geliştirdim",
  sourceRef: "React ile panel geliştirdim",
  rewritten: "React kullanarak müşteri panelini geliştirdim",
  verification: { status: "ok" as const, issues: [] },
  decision: "accepted" as const,
}

const taslak = {
  summary: {
    original: "3 yıl React deneyimi",
    rewritten: "React odaklı 3 yıllık frontend deneyimi",
    verification: { status: "ok" as const, issues: [] },
    decision: "accepted" as const,
  },
  bullets: [temizMadde],
  skillOrder: ["React", "TypeScript"],
}

describe("AdaptationDraftSchema", () => {
  it("geçerli bir taslağı kabul eder", () => {
    expect(AdaptationDraftSchema.parse(taslak)).toEqual(taslak)
  })

  it("tanımsız karar değerini reddeder", () => {
    expect(() =>
      AdaptationDraftSchema.parse({
        ...taslak,
        bullets: [{ ...temizMadde, decision: "belki" }],
      }),
    ).toThrow()
  })

  it("tanımsız uyarı türünü reddeder", () => {
    expect(() =>
      AdaptationDraftSchema.parse({
        ...taslak,
        bullets: [
          {
            ...temizMadde,
            verification: { status: "flagged", issues: [{ kind: "baska", detail: "x" }] },
          },
        ],
      }),
    ).toThrow()
  })

  it("sourceRef zorunludur", () => {
    const { sourceRef: _atilan, ...eksik } = temizMadde
    expect(() => AdaptationDraftSchema.parse({ ...taslak, bullets: [eksik] })).toThrow()
  })
})

describe("hasPendingDecisions", () => {
  it("bekleyen karar yoksa false döner", () => {
    expect(hasPendingDecisions(AdaptationDraftSchema.parse(taslak))).toBe(false)
  })

  it("bekleyen karar varsa true döner", () => {
    const bekleyen = AdaptationDraftSchema.parse({
      ...taslak,
      bullets: [
        temizMadde,
        {
          ...temizMadde,
          id: "b2",
          verification: {
            status: "flagged",
            issues: [{ kind: "number_mismatch", detail: "%60 kaynakta yok" }],
          },
          decision: "pending",
        },
      ],
    })
    expect(hasPendingDecisions(bekleyen)).toBe(true)
  })

  it("reddedilmiş madde bekleyen sayılmaz", () => {
    const reddedilmis = AdaptationDraftSchema.parse({
      ...taslak,
      bullets: [{ ...temizMadde, decision: "rejected" }],
    })
    expect(hasPendingDecisions(reddedilmis)).toBe(false)
  })
})
```

- [ ] **Adım 3: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test schemas/adaptation`
Beklenen: FAIL — `Cannot find module './adaptation.js'`

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Adım 1'deki dosya yazıldıktan sonra tekrar çalıştır.

Çalıştır: `pnpm --filter @uyarla/core test schemas/adaptation`
Beklenen: PASS — 7 test geçti.

- [ ] **Adım 5: Prisma modelini ekle**

`packages/db/prisma/schema.prisma` dosyasının sonuna ekle:

```prisma
model Adaptation {
  id String @id @default(cuid())

  // Bir analizin tek uyarlaması olur. Kullanıcı farklı sonuç istiyorsa
  // analizi yeniden çalıştırır; birden çok uyarlama tutmak hangisinin
  // indirildiğini izlemeyi gerektirir ve Sprint 2'de karşılığı yok.
  analysisId String   @unique
  analysis   Analysis @relation(fields: [analysisId], references: [id])

  /// Çalışma hâli: madde bazında özgün, yeniden yazım, doğrulama, karar.
  draft Json

  /// Kabul edilenlerden üretilen nihai sürüm; indirme anında doluyor.
  resumeVersionId String?
  resumeVersion   ResumeVersion? @relation("AdaptedFrom", fields: [resumeVersionId], references: [id])

  status     AdaptationStatus @default(running)
  modelId    String
  durationMs Int?
  tokenUsage Int?
  errorClass String?
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
}

enum AdaptationStatus {
  running
  draft
  ready
  failed
}
```

Ayrıca `Analysis` modeline ters ilişkiyi ekle:

```prisma
  adaptation Adaptation?
```

Ve `ResumeVersion` modeline:

```prisma
  adaptations Adaptation[] @relation("AdaptedFrom")
```

- [ ] **Adım 6: Migration'ı çalıştır**

Çalıştır:

```bash
pnpm --filter @uyarla/db migrate --name sprint2_adaptation
```

Beklenen: migration oluştu, "Your database is now in sync with your schema."

- [ ] **Adım 7: Dışa aktar, testleri çalıştır ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./schemas/adaptation.js"
```

```bash
pnpm --filter @uyarla/core test
pnpm --filter @uyarla/db migrate:status
git add packages/core packages/db
git commit -m "feat: Adaptation veri modeli ve çalışma belgesi şeması"
```

---

### Görev 2: Beceri sıralaması

Spec §6.3, K-27. Saf kod — LLM yok. Skor servisi hangi becerinin hangi
gereksinimi karşıladığını zaten biliyor.

**Dosyalar:**
- Oluştur: `packages/core/src/adapt/skills.ts`
- Test: `packages/core/src/adapt/skills.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Sprint 1'den `ScoreResult`, `RequirementResult`, `Evidence`.
- Üretir: `orderSkillsForPosting(skills: string[], result: ScoreResult): string[]`
- Görev 8 bunu çağırır.

- [ ] **Adım 1: Testi yaz**

`packages/core/src/adapt/skills.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import type { ScoreResult } from "../score/score.js"
import { orderSkillsForPosting } from "./skills.js"

/** Belirli becerileri kanıt gösteren sahte bir skor sonucu üretir. */
function sonuc(
  satirlar: Array<{ importance: "must" | "nice"; skill: string | null }>,
): ScoreResult {
  return {
    score: 50,
    missingKeywords: [],
    requirements: satirlar.map((s) => ({
      requirement: { text: "g", type: "skill", importance: s.importance, concepts: [] },
      status: s.skill ? "matched" : "missing",
      confidence: s.skill ? 1 : 0,
      method: s.skill ? "keyword" : null,
      evidence: s.skill
        ? { text: s.skill, matchText: s.skill, kind: "skill" as const, sourceRef: null }
        : null,
      matchedConcepts: [],
      missingConcepts: [],
    })),
  }
}

describe("orderSkillsForPosting", () => {
  it("must karşılayan beceriyi başa alır", () => {
    expect(
      orderSkillsForPosting(
        ["Docker", "React", "Excel"],
        sonuc([{ importance: "must", skill: "React" }]),
      ),
    ).toEqual(["React", "Docker", "Excel"])
  })

  it("must'ı nice'tan önce sıralar", () => {
    expect(
      orderSkillsForPosting(
        ["Excel", "Docker", "React"],
        sonuc([
          { importance: "nice", skill: "Docker" },
          { importance: "must", skill: "React" },
        ]),
      ),
    ).toEqual(["React", "Docker", "Excel"])
  })

  it("kalan becerilerin özgün sırasını korur", () => {
    expect(
      orderSkillsForPosting(
        ["Excel", "Word", "PowerPoint", "React"],
        sonuc([{ importance: "must", skill: "React" }]),
      ),
    ).toEqual(["React", "Excel", "Word", "PowerPoint"])
  })

  it("beceri kümesini değiştirmez: eklemez, silmez", () => {
    // K-27: sıralamanın riski sıfır olmasının sebebi budur.
    const beceriler = ["Docker", "React", "Excel", "SQL"]
    const sirali = orderSkillsForPosting(
      beceriler,
      sonuc([{ importance: "must", skill: "React" }]),
    )
    expect([...sirali].sort()).toEqual([...beceriler].sort())
  })

  it("beceri olmayan kanıtları yok sayar", () => {
    // Kanıt bir deneyim maddesi ya da eğitim kaydı olabilir; sıralama
    // yalnızca beceri kanıtlarına bakar.
    const sonucBullet: ScoreResult = {
      score: 50,
      missingKeywords: [],
      requirements: [
        {
          requirement: { text: "g", type: "skill", importance: "must", concepts: [] },
          status: "matched",
          confidence: 1,
          method: "keyword",
          evidence: {
            text: "Acme: React ile panel geliştirdim",
            matchText: "React ile panel geliştirdim",
            kind: "bullet",
            sourceRef: "React ile panel geliştirdim",
          },
          matchedConcepts: [],
          missingConcepts: [],
        },
      ],
    }
    expect(orderSkillsForPosting(["Docker", "React"], sonucBullet)).toEqual([
      "Docker",
      "React",
    ])
  })

  it("eşleşme yoksa sırayı bozmaz", () => {
    expect(orderSkillsForPosting(["A", "B"], sonuc([{ importance: "must", skill: null }]))).toEqual([
      "A",
      "B",
    ])
  })

  it("boş beceri listesinde boş döner", () => {
    expect(orderSkillsForPosting([], sonuc([{ importance: "must", skill: "React" }]))).toEqual([])
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test adapt/skills`
Beklenen: FAIL — `Cannot find module './skills.js'`

- [ ] **Adım 3: Uygula**

`packages/core/src/adapt/skills.ts`:

```ts
import { normalizeText } from "../normalize/turkish.js"
import type { ScoreResult } from "../score/score.js"

/**
 * Becerileri ilana göre sıralar.
 *
 * Küme değişmez: hiçbir beceri eklenmez, hiçbiri silinmez. Bu yüzden uydurma
 * riski sıfırdır ve doğrulamaya tabi değildir (K-27).
 *
 * Sıra: önce `must` gereksinimi karşılayanlar, sonra `nice` karşılayanlar,
 * sonra kalanlar özgün sıralarıyla. ATS tarayıcıları listenin başındaki
 * terimleri daha çok tarttığı için sıralama gerçek bir kazanç.
 *
 * LLM gerektirmiyor: skor servisi hangi becerinin hangi gereksinimi
 * karşıladığını `evidence` alanında zaten söylüyor.
 */
export function orderSkillsForPosting(
  skills: string[],
  result: ScoreResult,
): string[] {
  const must = new Set<string>()
  const nice = new Set<string>()

  for (const r of result.requirements) {
    if (r.status !== "matched" || r.evidence?.kind !== "skill") continue
    const anahtar = normalizeText(r.evidence.text)
    if (r.requirement.importance === "must") must.add(anahtar)
    else nice.add(anahtar)
  }

  const oncelik = (beceri: string): number => {
    const anahtar = normalizeText(beceri)
    if (must.has(anahtar)) return 0
    if (nice.has(anahtar)) return 1
    return 2
  }

  // Kararlı sıralama: aynı önceliktekiler özgün sıralarını korur.
  return skills
    .map((beceri, i) => ({ beceri, i, oncelik: oncelik(beceri) }))
    .sort((a, b) => a.oncelik - b.oncelik || a.i - b.i)
    .map((x) => x.beceri)
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test adapt/skills`
Beklenen: PASS — 7 test geçti.

- [ ] **Adım 5: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./adapt/skills.js"
```

```bash
pnpm --filter @uyarla/core test
git add packages/core
git commit -m "feat: becerilerin ilana göre sıralanması"
```

---

### Görev 3: Sayı kontrolü

Spec §7.1. Uydurma kontrolünün birinci ayağı. Kesin ve kullanıcıya
gösterilebilir gerekçe üretir.

**Dosyalar:**
- Oluştur: `packages/core/src/verify/numbers.ts`
- Test: `packages/core/src/verify/numbers.test.ts`

**Arayüzler:**
- Tüketir: Görev 1'den `VerificationIssue`.
- Üretir: `checkNumbers(rewritten: string, source: string): VerificationIssue[]`
- Görev 5 bunu çağırır.

- [ ] **Adım 1: Testi yaz**

`packages/core/src/verify/numbers.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { checkNumbers } from "./numbers.js"

describe("checkNumbers", () => {
  it("kaynaktaki sayı korunduğunda uyarı üretmez", () => {
    expect(
      checkNumbers(
        "Sayfa yüklenme süresini %40 düşürdüm",
        "Sayfa yüklenme süresini %40 düşürdüm",
      ),
    ).toEqual([])
  })

  it("sayı değiştirildiğinde uyarı üretir", () => {
    const uyarilar = checkNumbers(
      "Sayfa yüklenme süresini %60 düşürdüm",
      "Sayfa yüklenme süresini %40 düşürdüm",
    )
    expect(uyarilar).toHaveLength(1)
    expect(uyarilar[0]!.kind).toBe("number_mismatch")
    expect(uyarilar[0]!.detail).toContain("60")
  })

  it("yeni sayı eklendiğinde uyarı üretir", () => {
    const uyarilar = checkNumbers(
      "4 kişilik ekipte React ile panel geliştirdim",
      "React ile panel geliştirdim",
    )
    expect(uyarilar).toHaveLength(1)
    expect(uyarilar[0]!.detail).toContain("4")
  })

  it("kaynaktaki sayının düşürülmesi uyarı üretmez", () => {
    // Bilgi eksiltmek uydurma değil; kullanıcı zaten farkı görüyor.
    expect(
      checkNumbers("React ile panel geliştirdim", "4 kişilik ekipte React ile panel geliştirdim"),
    ).toEqual([])
  })

  it("ondalık sayıları tanır", () => {
    const uyarilar = checkNumbers("Skoru 9,4'e çıkardım", "Skoru 8,2'ye çıkardım")
    expect(uyarilar).toHaveLength(1)
  })

  it("aynı sayı birden çok kez geçse tek uyarı üretir", () => {
    const uyarilar = checkNumbers("%60 ve yine %60", "%40 düşürdüm")
    expect(uyarilar).toHaveLength(1)
  })

  it("yıl ve tarih gibi sayıları da kontrol eder", () => {
    expect(checkNumbers("2021 yılında mezun oldum", "2020 yılında mezun oldum")).toHaveLength(1)
  })

  it("gerekçe kullanıcıya gösterilebilir Türkçe olur", () => {
    const uyari = checkNumbers("%60 düşürdüm", "%40 düşürdüm")[0]!
    expect(uyari.detail).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(uyari.detail).not.toMatch(/error|mismatch|invalid/i)
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test verify/numbers`
Beklenen: FAIL — `Cannot find module './numbers.js'`

- [ ] **Adım 3: Uygula**

`packages/core/src/verify/numbers.ts`:

```ts
import type { VerificationIssue } from "../schemas/adaptation.js"

/** Tam sayılar ve ondalıklar; ondalık ayıracı virgül veya nokta olabilir. */
const SAYI = /\d+(?:[.,]\d+)?/g

/**
 * Yeniden yazımdaki her sayının kaynakta da bulunup bulunmadığını kontrol
 * eder (spec §7.1).
 *
 * Yalnızca EKLENEN veya DEĞİŞEN sayılar uyarı üretir. Kaynaktaki bir sayıyı
 * düşürmek uydurma değildir — bilgi eksiltmek kullanıcının zaten gördüğü bir
 * değişiklik.
 */
export function checkNumbers(rewritten: string, source: string): VerificationIssue[] {
  const kaynaktakiler = new Set(source.match(SAYI) ?? [])
  const yenidekiler = [...new Set(rewritten.match(SAYI) ?? [])]

  return yenidekiler
    .filter((sayi) => !kaynaktakiler.has(sayi))
    .map((sayi) => ({
      kind: "number_mismatch" as const,
      detail: `Bu maddede "${sayi}" sayısı geçiyor ama senin yazdığın hâlinde yok.`,
    }))
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test verify/numbers`
Beklenen: PASS — 8 test geçti.

- [ ] **Adım 5: Commit**

```bash
pnpm --filter @uyarla/core test
git add packages/core
git commit -m "feat: uydurma kontrolü — sayı kontrolü"
```

---

### Görev 4: İlan terimi enjeksiyonu kontrolü

Spec §7.2. Uydurmanın **en tehlikeli biçimi**: model, ilanın istediği şeyi
CV'ye yazıveriyor. Ve tam olarak tespit edilebilir — ilanın kavram listesi
elimizde (K-23).

**Dosyalar:**
- Oluştur: `packages/core/src/verify/injection.ts`
- Test: `packages/core/src/verify/injection.test.ts`

**Arayüzler:**
- Tüketir: Görev 1'den `VerificationIssue`; Sprint 1'den `containsKeyword`,
  `JobPostingData`.
- Üretir: `checkPostingTermInjection(rewritten: string, source: string, posting: JobPostingData): VerificationIssue[]`
- Görev 5 bunu çağırır.

- [ ] **Adım 1: Testi yaz**

`packages/core/src/verify/injection.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import type { JobPostingData } from "../schemas/job.js"
import { checkPostingTermInjection } from "./injection.js"

const ilan = (terimler: string[]): JobPostingData => ({
  position: "Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: terimler.map((t) => ({
    text: t,
    type: "skill",
    importance: "must",
    concepts: [{ term: t, synonyms: [t] }],
  })),
})

describe("checkPostingTermInjection", () => {
  it("kaynakta olan terim uyarı üretmez", () => {
    expect(
      checkPostingTermInjection(
        "React kullanarak müşteri panelini geliştirdim",
        "React ile müşteri panelini geliştirdim",
        ilan(["React", "Kubernetes"]),
      ),
    ).toEqual([])
  })

  it("kaynakta olmayan ilan terimi eklenirse uyarı üretir", () => {
    const uyarilar = checkPostingTermInjection(
      "React ve Kubernetes ile müşteri panelini geliştirdim",
      "React ile müşteri panelini geliştirdim",
      ilan(["React", "Kubernetes"]),
    )
    expect(uyarilar).toHaveLength(1)
    expect(uyarilar[0]!.kind).toBe("posting_term_injected")
    expect(uyarilar[0]!.detail).toContain("Kubernetes")
  })

  it("ilanda geçmeyen yeni kelime uyarı üretmez", () => {
    // Yalnızca ilan kavramları kontrol edilir; sıradan kelime değişikliği
    // yeniden ifadenin kendisidir.
    expect(
      checkPostingTermInjection(
        "React kullanarak kurumsal müşteri panelini hayata geçirdim",
        "React ile müşteri panelini geliştirdim",
        ilan(["React"]),
      ),
    ).toEqual([])
  })

  it("eş anlamlı biçimle eklenen terimi de yakalar", () => {
    const uyarilar = checkPostingTermInjection(
      "React ve k8s ile panel geliştirdim",
      "React ile panel geliştirdim",
      {
        ...ilan([]),
        requirements: [
          {
            text: "Kubernetes deneyimi",
            type: "skill",
            importance: "must",
            concepts: [{ term: "kubernetes", synonyms: ["kubernetes", "k8s"] }],
          },
        ],
      },
    )
    expect(uyarilar).toHaveLength(1)
    expect(uyarilar[0]!.detail).toContain("kubernetes")
  })

  it("çapraz dilli eşleşmede kaynakta varsa uyarı üretmez", () => {
    // Türkçe normalleştirme ve çapraz dilli sözlük devrede (K-21, K-25).
    expect(
      checkPostingTermInjection(
        "Software Engineering alanında çalıştım",
        "Yazılım Mühendisliği alanında çalıştım",
        ilan(["Yazılım Mühendisliği"]),
      ),
    ).toEqual([])
  })

  it("birden çok terim eklenirse her biri için uyarı üretir", () => {
    const uyarilar = checkPostingTermInjection(
      "React, Kubernetes ve Docker ile geliştirdim",
      "React ile geliştirdim",
      ilan(["React", "Kubernetes", "Docker"]),
    )
    expect(uyarilar).toHaveLength(2)
  })

  it("gerekçe kullanıcıya gösterilebilir Türkçe olur", () => {
    const uyari = checkPostingTermInjection(
      "Kubernetes ile geliştirdim",
      "React ile geliştirdim",
      ilan(["Kubernetes"]),
    )[0]!
    expect(uyari.detail).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(uyari.detail).not.toMatch(/error|injected|invalid/i)
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test verify/injection`
Beklenen: FAIL — `Cannot find module './injection.js'`

- [ ] **Adım 3: Uygula**

`packages/core/src/verify/injection.ts`:

```ts
import { containsKeyword } from "../normalize/turkish.js"
import type { VerificationIssue } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"

/**
 * Yeniden yazımda geçip kaynakta geçmeyen ilan kavramlarını işaretler
 * (spec §7.2).
 *
 * Uydurmanın en tehlikeli biçimi budur: model, ilanın istediği şeyi CV'ye
 * yazıverir. Ve tam olarak tespit edilebilir, çünkü ilanın kavram listesi
 * elimizde (K-23).
 *
 * Karşılaştırma `containsKeyword` ile yapılıyor; Türkçe normalleştirme ve
 * çapraz dilli sözlük (K-21, K-25) böylece kendiliğinden devrede.
 */
export function checkPostingTermInjection(
  rewritten: string,
  source: string,
  posting: JobPostingData,
): VerificationIssue[] {
  const kavramlar = posting.requirements.flatMap((r) => r.concepts)
  const uyarilar: VerificationIssue[] = []
  const gorulen = new Set<string>()

  for (const kavram of kavramlar) {
    if (gorulen.has(kavram.term)) continue

    const aranacaklar = [kavram.term, ...kavram.synonyms]
    const yazimdaVar = aranacaklar.some((t) => containsKeyword(rewritten, t))
    const kaynaktaVar = aranacaklar.some((t) => containsKeyword(source, t))

    if (yazimdaVar && !kaynaktaVar) {
      gorulen.add(kavram.term)
      uyarilar.push({
        kind: "posting_term_injected",
        detail: `Bu maddede "${kavram.term}" geçiyor ama senin yazdığın hâlinde yok.`,
      })
    }
  }

  return uyarilar
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test verify/injection`
Beklenen: PASS — 7 test geçti.

- [ ] **Adım 5: Commit**

```bash
pnpm --filter @uyarla/core test
git add packages/core
git commit -m "feat: uydurma kontrolü — ilan terimi enjeksiyonu"
```

---

### Görev 5: Anlamsal sapma ve birleşik doğrulayıcı

Spec §7.3. Üçüncü kontrol ve üçünü birleştiren yüzey. Sapma kontrolü
**ikincil**: eşik bir tahmindir ve ilk iki kontrol gibi kesin gerekçe
üretmez.

**Dosyalar:**
- Oluştur: `packages/core/src/verify/drift.ts`
- Oluştur: `packages/core/src/verify/verify.ts`
- Test: `packages/core/src/verify/drift.test.ts`
- Test: `packages/core/src/verify/verify.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Görev 1'den `Verification`, `VerificationIssue`; Görev 3'ten
  `checkNumbers`; Görev 4'ten `checkPostingTermInjection`; Sprint 1'den
  `cosineSimilarity`.
- Üretir:
  - `checkSemanticDrift(rewrittenVector: number[], sourceVector: number[], threshold: number): VerificationIssue[]`
  - `VerificationConfig { driftThreshold: number }`
  - `DEFAULT_VERIFICATION_CONFIG: VerificationConfig`
  - `VerifyInput { rewritten, source, posting, vectors? }`
  - `verifyRewrite(input: VerifyInput, cfg?: VerificationConfig): Verification`
- Görev 8 ve 14 `verifyRewrite`'ı çağırır.

- [ ] **Adım 1: Sapma testini yaz**

`packages/core/src/verify/drift.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { checkSemanticDrift } from "./drift.js"

const ESIK = 0.75

describe("checkSemanticDrift", () => {
  it("aynı vektörde uyarı üretmez", () => {
    expect(checkSemanticDrift([1, 0], [1, 0], ESIK)).toEqual([])
  })

  it("eşiğin altındaki benzerlikte uyarı üretir", () => {
    const uyarilar = checkSemanticDrift([1, 0], [0, 1], ESIK)
    expect(uyarilar).toHaveLength(1)
    expect(uyarilar[0]!.kind).toBe("semantic_drift")
  })

  it("eşiğin tam üstünde uyarı üretmez", () => {
    // 0.8 > 0.75: sınır davranışı kapsayıcı olmalı, yoksa eşik ayarı
    // beklenmedik yerde kayar.
    const uyarilar = checkSemanticDrift([0.8, 0.6], [1, 0], 0.75)
    expect(uyarilar).toEqual([])
  })

  it("eşiğe tam eşitken uyarı üretmez", () => {
    expect(checkSemanticDrift([1, 0], [1, 0], 1)).toEqual([])
  })

  it("gerekçe kullanıcıya gösterilebilir Türkçe olur", () => {
    const uyari = checkSemanticDrift([1, 0], [0, 1], ESIK)[0]!
    expect(uyari.detail).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(uyari.detail).not.toMatch(/drift|cosine|threshold/i)
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test verify/drift`
Beklenen: FAIL — `Cannot find module './drift.js'`

- [ ] **Adım 3: Sapma kontrolünü yaz**

`packages/core/src/verify/drift.ts`:

```ts
import { cosineSimilarity } from "../llm/embedding.js"
import type { VerificationIssue } from "../schemas/adaptation.js"

/**
 * Yeniden yazımın kaynaktan anlamca uzaklaşıp uzaklaşmadığını ölçer
 * (spec §7.3).
 *
 * Terim eklemeden anlamı abartmayı yakalar: "kod inceleme sürecine katkı
 * sağladım" → "kod inceleme sürecini kurdum ve ekibe liderlik ettim".
 *
 * İKİNCİL kontrol: eşik bir tahmindir, diğer ikisi gibi kesin gerekçe
 * üretmez. Kapsam kesme sırasında ikinci sırada (spec §16).
 */
export function checkSemanticDrift(
  rewrittenVector: number[],
  sourceVector: number[],
  threshold: number,
): VerificationIssue[] {
  const benzerlik = cosineSimilarity(rewrittenVector, sourceVector)
  if (benzerlik >= threshold) return []

  return [
    {
      kind: "semantic_drift",
      detail:
        "Bu madde senin yazdığından epey uzaklaşmış görünüyor. " +
        "Anlatılan işin aynı kaldığından emin ol.",
    },
  ]
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test verify/drift`
Beklenen: PASS — 5 test geçti.

- [ ] **Adım 5: Birleşik doğrulayıcının testini yaz**

`packages/core/src/verify/verify.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import type { JobPostingData } from "../schemas/job.js"
import { verifyRewrite, DEFAULT_VERIFICATION_CONFIG } from "./verify.js"

const ilan: JobPostingData = {
  position: "Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    {
      text: "Kubernetes deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "Kubernetes", synonyms: ["k8s"] }],
    },
  ],
}

describe("verifyRewrite", () => {
  it("temiz yeniden yazımda ok döner", () => {
    const v = verifyRewrite({
      rewritten: "React kullanarak müşteri panelini geliştirdim",
      source: "React ile müşteri panelini geliştirdim",
      posting: ilan,
    })
    expect(v).toEqual({ status: "ok", issues: [] })
  })

  it("sayı uyuşmazlığını işaretler", () => {
    const v = verifyRewrite({
      rewritten: "Süreyi %60 düşürdüm",
      source: "Süreyi %40 düşürdüm",
      posting: ilan,
    })
    expect(v.status).toBe("flagged")
    expect(v.issues.map((i) => i.kind)).toEqual(["number_mismatch"])
  })

  it("ilan terimi enjeksiyonunu işaretler", () => {
    const v = verifyRewrite({
      rewritten: "Kubernetes ile panel geliştirdim",
      source: "React ile panel geliştirdim",
      posting: ilan,
    })
    expect(v.status).toBe("flagged")
    expect(v.issues.map((i) => i.kind)).toEqual(["posting_term_injected"])
  })

  it("birden çok kontrol birden tetiklenirse hepsini toplar", () => {
    const v = verifyRewrite({
      rewritten: "Kubernetes ile süreyi %60 düşürdüm",
      source: "React ile süreyi %40 düşürdüm",
      posting: ilan,
    })
    expect(v.issues.map((i) => i.kind).sort()).toEqual([
      "number_mismatch",
      "posting_term_injected",
    ])
  })

  it("vektör verilmezse sapma kontrolü atlanır", () => {
    // Sapma kontrolü embedding gerektiriyor; çağıran onu sağlayamadığında
    // doğrulama tümüyle düşmemeli — ilk iki kontrol yine de çalışır.
    const v = verifyRewrite({
      rewritten: "React ile panel geliştirdim",
      source: "React ile panel geliştirdim",
      posting: ilan,
    })
    expect(v.issues).toEqual([])
  })

  it("vektör verilirse sapmayı da işaretler", () => {
    const v = verifyRewrite({
      rewritten: "React ile panel geliştirdim",
      source: "React ile panel geliştirdim",
      posting: ilan,
      vectors: { rewritten: [1, 0], source: [0, 1] },
    })
    expect(v.issues.map((i) => i.kind)).toEqual(["semantic_drift"])
  })

  it("eşik yapılandırmadan okunur", () => {
    // Eşik Görev 14'te eval verisiyle ayarlanacak; sabit yazılmamalı.
    const v = verifyRewrite(
      {
        rewritten: "a",
        source: "a",
        posting: ilan,
        vectors: { rewritten: [0.8, 0.6], source: [1, 0] },
      },
      { driftThreshold: 0.9 },
    )
    expect(v.issues.map((i) => i.kind)).toEqual(["semantic_drift"])
  })

  it("varsayılan eşik 0.75", () => {
    expect(DEFAULT_VERIFICATION_CONFIG.driftThreshold).toBe(0.75)
  })
})
```

- [ ] **Adım 6: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test verify/verify`
Beklenen: FAIL — `Cannot find module './verify.js'`

- [ ] **Adım 7: Birleşik doğrulayıcıyı yaz**

`packages/core/src/verify/verify.ts`:

```ts
import type { Verification } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import { checkSemanticDrift } from "./drift.js"
import { checkPostingTermInjection } from "./injection.js"
import { checkNumbers } from "./numbers.js"

export interface VerificationConfig {
  /** Altında anlamsal sapma sayılan kosinüs benzerliği. */
  driftThreshold: number
}

/**
 * Başlangıç değeri; Görev 14'te değerlendirme setiyle ayarlanacak (spec §7.3).
 */
export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  driftThreshold: 0.75,
}

export interface VerifyInput {
  rewritten: string
  /** Ham CV metnindeki birebir karşılık — doğrulamanın tek kaynağı. */
  source: string
  posting: JobPostingData
  /**
   * Anlamsal sapma kontrolü için vektörler. Verilmezse o kontrol atlanır;
   * kesin olan ilk iki kontrol yine çalışır.
   */
  vectors?: { rewritten: number[]; source: number[] }
}

/**
 * Bir yeniden yazımı üç deterministik kontrolden geçirir (spec §7).
 *
 * Saf fonksiyon: LLM çağırmaz, ağa çıkmaz. Sprint 1'in dersi gereği yargıyı
 * modele bırakmıyoruz — LLM hakem, uydurmayı uydurmayla denetlemek olurdu
 * (K-28).
 */
export function verifyRewrite(
  input: VerifyInput,
  cfg: VerificationConfig = DEFAULT_VERIFICATION_CONFIG,
): Verification {
  const issues = [
    ...checkNumbers(input.rewritten, input.source),
    ...checkPostingTermInjection(input.rewritten, input.source, input.posting),
    ...(input.vectors
      ? checkSemanticDrift(input.vectors.rewritten, input.vectors.source, cfg.driftThreshold)
      : []),
  ]

  return { status: issues.length > 0 ? "flagged" : "ok", issues }
}
```

- [ ] **Adım 8: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test verify/`
Beklenen: PASS — 28 test geçti (sayı 8, enjeksiyon 7, sapma 5, birleşik 8).

- [ ] **Adım 9: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./verify/numbers.js"
export * from "./verify/injection.js"
export * from "./verify/drift.js"
export * from "./verify/verify.js"
```

```bash
pnpm --filter @uyarla/core test
pnpm --filter @uyarla/core typecheck
git add packages/core
git commit -m "feat: uydurma kontrolü — anlamsal sapma ve birleşik doğrulayıcı"
```

---

### Görev 6: Özet ve madde yeniden yazımı

Spec §6.1, §6.2. Sprintin tek LLM işi. **Madde başına bir çağrı** — girdi
daraldıkça uydurma kaynağı daralıyor ve hata izole oluyor.

**Dosyalar:**
- Oluştur: `packages/core/src/adapt/prompts.ts`
- Oluştur: `packages/core/src/adapt/rewrite.ts`
- Test: `packages/core/src/adapt/rewrite.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Sprint 1'den `LlmProvider`, `ExtractResult`, `toJsonSchema`,
  `JobPostingData`.
- Üretir:
  - `SUMMARY_PROMPT`, `BULLET_PROMPT` (string)
  - `mustConceptTerms(posting: JobPostingData): string[]`
  - `rewriteSummary(llm, input: { summary: string; posting: JobPostingData }): Promise<ExtractResult<string>>`
  - `rewriteBullet(llm, input: { bullet: string; posting: JobPostingData }): Promise<ExtractResult<string>>`
  - `rewriteBullets(llm, bullets: string[], posting): Promise<Array<ExtractResult<string> | null>>`
- Görev 8 bunları çağırır.

- [ ] **Adım 1: Testi yaz**

`packages/core/src/adapt/rewrite.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import type { LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import { mustConceptTerms, rewriteBullet, rewriteBullets, rewriteSummary } from "./rewrite.js"

const ilan: JobPostingData = {
  position: "Frontend Geliştirici",
  company: "Acme",
  seniority: "mid",
  language: "tr",
  requirements: [
    {
      text: "React deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "React", synonyms: ["react.js"] }],
    },
    {
      text: "Tercihen Kubernetes",
      type: "skill",
      importance: "nice",
      concepts: [{ term: "Kubernetes", synonyms: [] }],
    },
  ],
}

/** Verilen metni döndüren sahte sağlayıcı. */
function sahteLlm(rewritten: string | (() => never)): LlmProvider {
  return {
    extract: vi.fn(async () => {
      if (typeof rewritten === "function") rewritten()
      return { data: { rewritten } as never, tokens: 12 }
    }),
  }
}

describe("mustConceptTerms", () => {
  it("yalnızca must gereksinimlerinin kavramlarını verir", () => {
    expect(mustConceptTerms(ilan)).toEqual(["React"])
  })

  it("tekrarlanan kavramı bir kez verir", () => {
    const tekrarli: JobPostingData = {
      ...ilan,
      requirements: [ilan.requirements[0]!, ilan.requirements[0]!],
    }
    expect(mustConceptTerms(tekrarli)).toEqual(["React"])
  })
})

describe("rewriteBullet", () => {
  it("yeniden yazılmış maddeyi ve token sayısını döndürür", async () => {
    const llm = sahteLlm("React ile müşteri panelini hayata geçirdim")
    const sonuc = await rewriteBullet(llm, {
      bullet: "React ile panel yaptım",
      posting: ilan,
    })
    expect(sonuc.data).toBe("React ile müşteri panelini hayata geçirdim")
    expect(sonuc.tokens).toBe(12)
  })

  it("modele yalnızca o maddeyi ve must kavramlarını verir", async () => {
    // Madde başına çağrının bütün anlamı bu: girdi daraldıkça uydurma
    // kaynağı daralıyor (spec §6.2).
    const llm = sahteLlm("x")
    await rewriteBullet(llm, { bullet: "React ile panel yaptım", posting: ilan })

    const cagri = vi.mocked(llm.extract).mock.calls[0]![0]
    expect(cagri.input).toContain("React ile panel yaptım")
    expect(cagri.input).toContain("React")
    expect(cagri.input).not.toContain("Kubernetes")
  })

  it("boş dönerse orijinali korur", async () => {
    // Model boş string döndürebiliyor; maddeyi silmek veri kaybı olurdu.
    const llm = sahteLlm("   ")
    const sonuc = await rewriteBullet(llm, { bullet: "React ile panel yaptım", posting: ilan })
    expect(sonuc.data).toBe("React ile panel yaptım")
  })
})

describe("rewriteSummary", () => {
  it("özeti yeniden yazar", async () => {
    const llm = sahteLlm("React odaklı frontend geliştirici")
    const sonuc = await rewriteSummary(llm, {
      summary: "Frontend geliştirici",
      posting: ilan,
    })
    expect(sonuc.data).toBe("React odaklı frontend geliştirici")
  })

  it("modele pozisyon adını da verir", async () => {
    // Özet kullanıcının kendini tanıttığı yer; vurguyu role göre değiştirmek
    // meşru (spec §6.1).
    const llm = sahteLlm("x")
    await rewriteSummary(llm, { summary: "Frontend geliştirici", posting: ilan })
    expect(vi.mocked(llm.extract).mock.calls[0]![0].input).toContain("Frontend Geliştirici")
  })
})

describe("rewriteBullets", () => {
  it("her madde için ayrı çağrı yapar", async () => {
    const llm = sahteLlm("yeni")
    const sonuclar = await rewriteBullets(llm, ["bir", "iki", "üç"], ilan)
    expect(llm.extract).toHaveBeenCalledTimes(3)
    expect(sonuclar.map((s) => s?.data)).toEqual(["yeni", "yeni", "yeni"])
  })

  it("bir madde patlarsa yalnızca o madde null olur", async () => {
    // Madde başına izolasyon, madde başına çağrının ikinci faydası
    // (spec §13): bir çağrı patlarsa tüm uyarlama değil o madde kaybedilir.
    let sayac = 0
    const llm: LlmProvider = {
      extract: vi.fn(async () => {
        sayac++
        if (sayac === 2) throw new Error("model düştü")
        return { data: { rewritten: "yeni" } as never, tokens: 5 }
      }),
    }
    const sonuclar = await rewriteBullets(llm, ["bir", "iki", "üç"], ilan)
    expect(sonuclar.map((s) => s?.data ?? null)).toEqual(["yeni", null, "yeni"])
  })

  it("boş listede çağrı yapmaz", async () => {
    const llm = sahteLlm("yeni")
    expect(await rewriteBullets(llm, [], ilan)).toEqual([])
    expect(llm.extract).not.toHaveBeenCalled()
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test adapt/rewrite`
Beklenen: FAIL — `Cannot find module './rewrite.js'`

- [ ] **Adım 3: Prompt'ları yaz**

`packages/core/src/adapt/prompts.ts`:

```ts
export const BULLET_PROMPT = `Sana bir CV'den TEK bir deneyim maddesi ve bir
iş ilanının aradığı kavramlar verilecek.

Maddeyi ilanın diliyle yeniden ifade et.

Kesin kurallar:
- Yeni bilgi EKLEME. Maddede olmayan bir teknoloji, araç veya sorumluluk yazma.
- Sayıları DEĞİŞTİRME. Yüzde, yıl, adet — hepsi aynı kalsın.
- İlanın aradığı bir kavram maddede geçmiyorsa onu YAZMA.
- İşin kapsamını büyütme. "katkı sağladım" ise "kurdum" yazma.

Yalnızca ifadeyi değiştir: fiil seçimi, sıralama, ilanın kullandığı terim
zaten maddede varsa onun yazımı. Madde tek cümle kalsın.`

export const SUMMARY_PROMPT = `Sana bir CV'nin özeti, başvurulan pozisyon ve
ilanın aradığı kavramlar verilecek.

Özeti bu pozisyona göre yeniden ifade et: hangi deneyimin öne çıkacağını
değiştirebilirsin.

Kesin kurallar:
- Yeni bilgi EKLEME. Özette olmayan bir teknoloji, deneyim yılı veya unvan yazma.
- Sayıları DEĞİŞTİRME.
- İlanın aradığı bir kavram özette geçmiyorsa onu YAZMA.

En fazla üç cümle.`
```

- [ ] **Adım 4: Yeniden yazma servisini yaz**

`packages/core/src/adapt/rewrite.ts`:

```ts
import { z } from "zod"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import { toJsonSchema } from "../schemas/toJsonSchema.js"
import { BULLET_PROMPT, SUMMARY_PROMPT } from "./prompts.js"

const RewriteSchema = z.object({ rewritten: z.string() })
const rewriteJsonSchema = toJsonSchema(RewriteSchema)

/**
 * İlanın `must` gereksinimlerindeki kavramlar, tekilleştirilmiş.
 *
 * Yalnızca `must`: modele verilen bağlam ne kadar darsa uydurma ihtimali o
 * kadar düşük, ve "tercihen" kavramlarını hedeflemenin kazancı yok.
 */
export function mustConceptTerms(posting: JobPostingData): string[] {
  return [
    ...new Set(
      posting.requirements
        .filter((r) => r.importance === "must")
        .flatMap((r) => r.concepts.map((c) => c.term)),
    ),
  ]
}

async function callRewrite(
  llm: LlmProvider,
  prompt: string,
  schemaName: string,
  input: string,
  fallback: string,
): Promise<ExtractResult<string>> {
  const { data, tokens } = await llm.extract({
    prompt,
    schemaName,
    schema: rewriteJsonSchema,
    input,
  })
  const { rewritten } = RewriteSchema.parse(data)
  // Boş dönüş maddeyi silmek anlamına gelirdi; orijinal korunur.
  return { data: rewritten.trim() || fallback, tokens }
}

export async function rewriteBullet(
  llm: LlmProvider,
  input: { bullet: string; posting: JobPostingData },
): Promise<ExtractResult<string>> {
  const kavramlar = mustConceptTerms(input.posting)
  const metin = [
    `Madde: ${input.bullet}`,
    `İlanın aradığı kavramlar: ${kavramlar.join(", ") || "—"}`,
  ].join("\n")

  return callRewrite(llm, BULLET_PROMPT, "rewritten_bullet", metin, input.bullet)
}

export async function rewriteSummary(
  llm: LlmProvider,
  input: { summary: string; posting: JobPostingData },
): Promise<ExtractResult<string>> {
  const kavramlar = mustConceptTerms(input.posting)
  const metin = [
    `Özet: ${input.summary}`,
    `Pozisyon: ${input.posting.position}`,
    `İlanın aradığı kavramlar: ${kavramlar.join(", ") || "—"}`,
  ].join("\n")

  return callRewrite(llm, SUMMARY_PROMPT, "rewritten_summary", metin, input.summary)
}

/**
 * Maddeleri paralel yeniden yazar; patlayan madde `null` döner.
 *
 * Paralellik kazancı ölçülmeli: Sprint 1'de üç eşzamanlı büyük çağrı yalnızca
 * 1,29x kazandırmıştı (K-16). Madde çağrıları küçük ve davranış farklı
 * olabilir — Görev 14 bunu ölçüyor.
 *
 * `allSettled`: bir maddenin patlaması diğerlerini düşürmemeli (spec §13).
 */
export async function rewriteBullets(
  llm: LlmProvider,
  bullets: string[],
  posting: JobPostingData,
): Promise<Array<ExtractResult<string> | null>> {
  const sonuclar = await Promise.allSettled(
    bullets.map((bullet) => rewriteBullet(llm, { bullet, posting })),
  )
  return sonuclar.map((s) => (s.status === "fulfilled" ? s.value : null))
}
```

- [ ] **Adım 5: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test adapt/rewrite`
Beklenen: PASS — 10 test geçti.

- [ ] **Adım 6: Gerçek modelle tümleşik test yaz**

`packages/core/src/adapt/rewrite.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import type { JobPostingData } from "../schemas/job.js"
import { verifyRewrite } from "../verify/verify.js"
import { rewriteBullet } from "./rewrite.js"

const ilan: JobPostingData = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    {
      text: "React ve TypeScript deneyimi",
      type: "skill",
      importance: "must",
      concepts: [
        { term: "React", synonyms: ["react.js"] },
        { term: "TypeScript", synonyms: ["ts"] },
      ],
    },
    {
      text: "Kubernetes deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "Kubernetes", synonyms: ["k8s"] }],
    },
  ],
}

describe("rewriteBullet · gerçek model", () => {
  it("bir maddeyi yeniden yazar ve doğrulamadan geçer", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const kaynak = "React ile müşteri panelini geliştirdim ve yüklenme süresini %40 düşürdüm"

    const { data: yeni } = await rewriteBullet(llm, { bullet: kaynak, posting: ilan })
    const dogrulama = verifyRewrite({ rewritten: yeni, source: kaynak, posting: ilan })

    console.log(`[ölçüm] kaynak: ${kaynak}`)
    console.log(`[ölçüm] yazım : ${yeni}`)
    console.log(`[ölçüm] uyarı : ${dogrulama.issues.map((i) => i.kind).join(", ") || "yok"}`)

    expect(yeni.length).toBeGreaterThan(0)
    expect(yeni).not.toBe(kaynak)
    // CV'de olmayan Kubernetes eklenmemeli.
    expect(dogrulama.issues.filter((i) => i.kind === "posting_term_injected")).toEqual([])
  })
})
```

- [ ] **Adım 7: Tümleşik testi çalıştır**

LM Studio ve Ollama'nın açık olduğundan emin ol.

Çalıştır: `pnpm --filter @uyarla/core test:integration adapt/rewrite`
Beklenen: PASS. Konsoldaki kaynak/yazım çıktısını gözle incele — model
gerçekten yeniden ifade ediyor mu, yoksa kopyalıyor mu? Kopyalıyorsa
`BULLET_PROMPT`'a "farklı fiil kullan" satırı eklenir ve ölçüm tekrarlanır.

- [ ] **Adım 8: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./adapt/prompts.js"
export * from "./adapt/rewrite.js"
```

```bash
pnpm --filter @uyarla/core test
pnpm --filter @uyarla/core typecheck
git add packages/core
git commit -m "feat: özet ve madde yeniden yazımı"
```

---

### Görev 7: Kabul edilen taslaktan profil ve yeni skor

Spec §10. Yeni LLM çağrısı yok — çıkarım zaten yapılmış, yalnızca kanıt
kümesi değişmiş oluyor.

**Dosyalar:**
- Oluştur: `packages/core/src/adapt/profile.ts`
- Test: `packages/core/src/adapt/profile.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Görev 1'den `AdaptationDraft`; Sprint 1'den `ResumeProfile`.
- Üretir:
  - `bulletId(experienceIndex: number, bulletIndex: number): string`
  - `applyAdaptation(profile: ResumeProfile, draft: AdaptationDraft): ResumeProfile`
- Görev 8, 12 ve 14 bunları çağırır. `bulletId` taslaktaki `id` alanının
  tek üretim noktasıdır.

- [ ] **Adım 1: Testi yaz**

`packages/core/src/adapt/profile.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { applyAdaptation, bulletId } from "./profile.js"

const profil: ResumeProfile = {
  fullName: "Test Aday",
  headline: null,
  summary: "Frontend geliştirici",
  experience: [
    {
      company: "Acme",
      title: "Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [
        { text: "React ile panel yaptım", sourceRef: "React ile panel yaptım" },
        { text: "Test yazdım", sourceRef: "Test yazdım" },
      ],
    },
  ],
  education: [{ school: "İTÜ", degree: "Lisans", field: "Bilgisayar", endDate: "2021" }],
  skills: ["Excel", "React"],
  languages: ["İngilizce"],
  certifications: ["AWS"],
}

const taslak: AdaptationDraft = {
  summary: {
    original: "Frontend geliştirici",
    rewritten: "React odaklı frontend geliştirici",
    verification: { status: "ok", issues: [] },
    decision: "accepted",
  },
  bullets: [
    {
      id: bulletId(0, 0),
      experienceIndex: 0,
      original: "React ile panel yaptım",
      sourceRef: "React ile panel yaptım",
      rewritten: "React ile müşteri panelini geliştirdim",
      verification: { status: "ok", issues: [] },
      decision: "accepted",
    },
    {
      id: bulletId(0, 1),
      experienceIndex: 0,
      original: "Test yazdım",
      sourceRef: "Test yazdım",
      rewritten: "Birim test altyapısını kurdum",
      verification: { status: "flagged", issues: [{ kind: "semantic_drift", detail: "…" }] },
      decision: "rejected",
    },
  ],
  skillOrder: ["React", "Excel"],
}

describe("bulletId", () => {
  it("deneyim ve madde sırasından kararlı bir kimlik üretir", () => {
    expect(bulletId(0, 0)).toBe("0-0")
    expect(bulletId(2, 5)).toBe("2-5")
  })
})

describe("applyAdaptation", () => {
  it("kabul edilen maddeyi yeniden yazımla değiştirir", () => {
    const sonuc = applyAdaptation(profil, taslak)
    expect(sonuc.experience[0]!.bullets[0]!.text).toBe("React ile müşteri panelini geliştirdim")
  })

  it("reddedilen maddede orijinali korur", () => {
    const sonuc = applyAdaptation(profil, taslak)
    expect(sonuc.experience[0]!.bullets[1]!.text).toBe("Test yazdım")
  })

  it("karara bağlanmamış maddede orijinali korur", () => {
    // pending, henüz onaylanmamış demek; kabul edilmiş gibi davranmak
    // kullanıcının görmediği metni CV'sine koyardı.
    const bekleyen: AdaptationDraft = {
      ...taslak,
      bullets: [{ ...taslak.bullets[0]!, decision: "pending" }],
    }
    expect(applyAdaptation(profil, bekleyen).experience[0]!.bullets[0]!.text).toBe(
      "React ile panel yaptım",
    )
  })

  it("sourceRef'i her zaman korur", () => {
    // Doğrulamanın kaynağı bu; yeniden yazımla değişmemeli.
    const sonuc = applyAdaptation(profil, taslak)
    expect(sonuc.experience[0]!.bullets[0]!.sourceRef).toBe("React ile panel yaptım")
  })

  it("kabul edilen özeti kullanır", () => {
    expect(applyAdaptation(profil, taslak).summary).toBe("React odaklı frontend geliştirici")
  })

  it("reddedilen özette orijinali korur", () => {
    const red: AdaptationDraft = {
      ...taslak,
      summary: { ...taslak.summary, decision: "rejected" },
    }
    expect(applyAdaptation(profil, red).summary).toBe("Frontend geliştirici")
  })

  it("becerileri taslaktaki sıraya göre dizer", () => {
    expect(applyAdaptation(profil, taslak).skills).toEqual(["React", "Excel"])
  })

  it("skillOrder'da olmayan beceriyi düşürmez", () => {
    // Küme değişmezliği (K-27) burada da korunmalı: eksik bir sıralama
    // sessizce beceri silemez.
    const eksik: AdaptationDraft = { ...taslak, skillOrder: ["React"] }
    expect(applyAdaptation(profil, eksik).skills.sort()).toEqual(["Excel", "React"])
  })

  it("eğitim, dil ve sertifikaları değiştirmez", () => {
    // Bunlar olgudur; ilana göre değişecek ifade payı yok (spec §6.4).
    const sonuc = applyAdaptation(profil, taslak)
    expect(sonuc.education).toEqual(profil.education)
    expect(sonuc.languages).toEqual(profil.languages)
    expect(sonuc.certifications).toEqual(profil.certifications)
  })

  it("girdi profilini değiştirmez", () => {
    applyAdaptation(profil, taslak)
    expect(profil.experience[0]!.bullets[0]!.text).toBe("React ile panel yaptım")
  })

  it("taslakta karşılığı olmayan maddeyi orijinal bırakır", () => {
    const bos: AdaptationDraft = { ...taslak, bullets: [] }
    expect(applyAdaptation(profil, bos).experience[0]!.bullets[0]!.text).toBe(
      "React ile panel yaptım",
    )
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test adapt/profile`
Beklenen: FAIL — `Cannot find module './profile.js'`

- [ ] **Adım 3: Uygula**

`packages/core/src/adapt/profile.ts`:

```ts
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { ResumeProfile } from "../schemas/resume.js"

/**
 * Bir maddenin kararlı kimliği.
 *
 * Kimlik konumdan türetiliyor: taslak ile profil aynı çıkarımdan geliyor ve
 * sıraları değişmiyor. Rastgele kimlik üretmek, taslağı profile geri
 * bağlamak için ayrı bir eşleme tablosu gerektirirdi.
 */
export function bulletId(experienceIndex: number, bulletIndex: number): string {
  return `${experienceIndex}-${bulletIndex}`
}

/**
 * Kabul edilen kararlardan yeni bir profil üretir (spec §10).
 *
 * Yalnızca `accepted` olanlar uygulanıyor: `rejected` kullanıcının hayır
 * dediği, `pending` ise henüz görmediği metin.
 *
 * Yeni LLM çağrısı yok — çıkarım zaten yapılmış, yalnızca kanıt kümesi
 * değişiyor. Sonuç Sprint 1'in skor servisine olduğu gibi verilebilir.
 */
export function applyAdaptation(
  profile: ResumeProfile,
  draft: AdaptationDraft,
): ResumeProfile {
  const kabulEdilenler = new Map(
    draft.bullets.filter((b) => b.decision === "accepted").map((b) => [b.id, b.rewritten]),
  )

  return {
    ...profile,
    summary:
      draft.summary.decision === "accepted" ? draft.summary.rewritten : draft.summary.original,
    experience: profile.experience.map((job, i) => ({
      ...job,
      bullets: job.bullets.map((bullet, j) => ({
        ...bullet,
        text: kabulEdilenler.get(bulletId(i, j)) ?? bullet.text,
        // sourceRef asla değişmez: doğrulamanın tek kaynağı bu.
      })),
    })),
    skills: sirala(profile.skills, draft.skillOrder),
    // Eğitim, diller ve sertifikalar dokunulmadan geçer (spec §6.4).
  }
}

/**
 * Becerileri verilen sıraya dizer; sırada geçmeyenler sonda, özgün
 * sıralarıyla kalır. Küme değişmez (K-27).
 */
function sirala(skills: string[], order: string[]): string[] {
  const sira = new Map(order.map((beceri, i) => [beceri, i]))
  return skills
    .map((beceri, i) => ({ beceri, i, sira: sira.get(beceri) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.sira - b.sira || a.i - b.i)
    .map((x) => x.beceri)
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test adapt/profile`
Beklenen: PASS — 12 test geçti.

- [ ] **Adım 5: Yeniden skorlama testini yaz**

`packages/core/src/adapt/rescore.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import type { EmbeddingProvider } from "../llm/types.js"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { rescore } from "./rescore.js"

const profil: ResumeProfile = {
  fullName: "Test", headline: null, summary: null,
  experience: [
    {
      company: "Acme", title: "Geliştirici", startDate: "2022", endDate: "halen",
      bullets: [{ text: "panel yaptım", sourceRef: "panel yaptım" }],
    },
  ],
  education: [], skills: [], languages: [], certifications: [],
}

const ilan: JobPostingData = {
  position: "Geliştirici", company: null, seniority: null, language: "tr",
  requirements: [
    {
      text: "React deneyimi", type: "skill", importance: "must",
      concepts: [{ term: "React", synonyms: [] }],
    },
  ],
}

const taslak: AdaptationDraft = {
  summary: {
    original: null, rewritten: "", verification: { status: "ok", issues: [] },
    decision: "accepted",
  },
  bullets: [
    {
      id: "0-0", experienceIndex: 0, original: "panel yaptım", sourceRef: "panel yaptım",
      rewritten: "React ile panel yaptım", verification: { status: "ok", issues: [] },
      decision: "accepted",
    },
  ],
  skillOrder: [],
}

/** Hiçbir şeye yakın olmayan vektörler: anlamsal katman devre dışı kalır. */
const embedding: EmbeddingProvider = {
  embed: vi.fn(async (t: string[]) => t.map((_, i) => (i % 2 === 0 ? [1, 0] : [0, 1]))),
}

describe("rescore", () => {
  it("kabul edilen yeniden yazımla kazanılan eşleşmeyi skora yansıtır", async () => {
    const yeni = await rescore({ profile: profil, posting: ilan, draft: taslak }, embedding)
    expect(yeni).toBeGreaterThan(0)
  })

  it("kabul edilmemiş yeniden yazım skora girmez", async () => {
    const red: AdaptationDraft = {
      ...taslak,
      bullets: [{ ...taslak.bullets[0]!, decision: "rejected" }],
    }
    expect(await rescore({ profile: profil, posting: ilan, draft: red }, embedding)).toBe(0)
  })

  it("yeni LLM çağrısı yapmaz", async () => {
    // spec §10: çıkarım zaten yapılmış, yalnızca kanıt kümesi değişiyor.
    // rescore bir LlmProvider bile almıyor; bu test o sözleşmeyi sabitliyor.
    await rescore({ profile: profil, posting: ilan, draft: taslak }, embedding)
    expect(embedding.embed).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Adım 6: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test adapt/rescore`
Beklenen: FAIL — `Cannot find module './rescore.js'`

- [ ] **Adım 7: Yeniden skorlamayı yaz**

`packages/core/src/adapt/rescore.ts`:

```ts
import type { EmbeddingProvider } from "../llm/types.js"
import type { AdaptationDraft } from "../schemas/adaptation.js"
import type { JobPostingData } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { collectEvidence } from "../score/evidence.js"
import { conceptTexts, score } from "../score/score.js"
import { applyAdaptation } from "./profile.js"

/**
 * Kabul edilen içerikten yeni skoru hesaplar (spec §10).
 *
 * Yeni LLM çağrısı yok — imzada `LlmProvider` bile geçmiyor. Çıkarım Sprint
 * 1'de yapıldı; burada değişen tek şey kanıt kümesi.
 *
 * Skorun yükselmesi garanti değil ve bu dürüstçe yansıtılıyor: yeniden ifade
 * gerçekten eşleşme kazandırmadıysa skor da değişmiyor.
 */
export async function rescore(
  input: { profile: ResumeProfile; posting: JobPostingData; draft: AdaptationDraft },
  embedding: EmbeddingProvider,
): Promise<number> {
  const uyarlanmis = applyAdaptation(input.profile, input.draft)
  const kanitlar = collectEvidence(uyarlanmis)
  const kanitMetinleri = kanitlar.map((k) => k.text)
  const kavramMetinleri = conceptTexts(input.posting)

  // Tek toplu çağrı: kanıtlar önce, kavramlar sonra (Sprint 1'deki sıra).
  const vektorler = await embedding.embed([...kanitMetinleri, ...kavramMetinleri])

  return score({
    profile: uyarlanmis,
    posting: input.posting,
    evidence: kanitlar,
    evidenceVectors: vektorler.slice(0, kanitMetinleri.length),
    conceptVectors: vektorler.slice(kanitMetinleri.length),
  }).score
}
```

- [ ] **Adım 8: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test adapt/`
Beklenen: PASS — 32 test geçti (beceri 7, yeniden yazma 10, profil 12,
yeniden skorlama 3).

- [ ] **Adım 9: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./adapt/profile.js"
export * from "./adapt/rescore.js"
```

```bash
pnpm --filter @uyarla/core test
pnpm --filter @uyarla/core typecheck
git add packages/core
git commit -m "feat: kabul edilen taslaktan profil üretimi ve yeniden skorlama"
```

---

### Görev 8: Uyarlama hattı ve kuyruk işi

Spec §4, §13. Görev 2–7'de yazılan saf parçaları birleştiren yer. Hat
Prisma'yı bilmiyor; `AdaptationStore` portundan geçiyor — Sprint 1'deki
`AnalysisStore` ile aynı desen.

**Dosyalar:**
- Oluştur: `apps/worker/src/adapt-types.ts`
- Oluştur: `apps/worker/src/adapt-queue.ts`
- Oluştur: `apps/worker/src/adapt-pipeline.ts`
- Oluştur: `apps/worker/src/adapt-store.ts`
- Test: `apps/worker/src/adapt-pipeline.test.ts`
- Değiştir: `apps/worker/src/index.ts`
- Değiştir: `apps/worker/package.json` (`./adapt-queue` dışa aktarımı)

**Arayüzler:**
- Tüketir: Görev 1, 2, 5, 6, 7'nin tümü; Sprint 1'den `collectEvidence`,
  `conceptTexts`, `score`.
- Üretir:
  - `ADAPT_QUEUE`, `AdaptJobData { adaptationId: string }`, `ADAPT_JOB_OPTIONS`
  - `AdaptationContext { profile, posting, result }`
  - `AdaptationStore` portu
  - `AdaptPipelineDeps`, `AdaptStage`
  - `runAdaptation(deps: AdaptPipelineDeps, input: { adaptationId: string }): Promise<void>`
  - `prismaAdaptationStore: AdaptationStore`
- Görev 12 kuyruğu ve store'u kullanır.

- [ ] **Adım 1: Kuyruk tanımını yaz**

`apps/worker/src/adapt-queue.ts`:

```ts
export const ADAPT_QUEUE = "adapt"

export interface AdaptJobData {
  /**
   * Uyarlama kaydı web katmanında oluşturuluyor ve kimliği buraya geliyor.
   *
   * Sprint 1'de arayüz BullMQ iş kimliğini yokluyordu; burada olmaz: kararlar
   * ve indirme de aynı kaydı adreslemek zorunda ve iş kimliği kuyruk
   * temizlendiğinde kayboluyor.
   */
  adaptationId: string
}

/** Geçici hatalarda üstel geri çekilmeyle 3 deneme (spec §13). */
export const ADAPT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
}
```

`apps/worker/package.json` içindeki `exports` bloğuna ekle:

```json
    "./adapt-queue": "./src/adapt-queue.ts"
```

- [ ] **Adım 2: Port ve bağımlılık tiplerini yaz**

`apps/worker/src/adapt-types.ts`:

```ts
import type {
  AdaptationDraft,
  EmbeddingProvider,
  JobPostingData,
  LlmProvider,
  ResumeProfile,
  ScoreResult,
} from "@uyarla/core"

/** Uyarlamanın dayandığı, Sprint 1'de üretilmiş veri. */
export interface AdaptationContext {
  profile: ResumeProfile
  posting: JobPostingData
  result: ScoreResult
}

/**
 * Hattın ihtiyaç duyduğu kalıcılık işlemleri.
 *
 * Prisma doğrudan çağrılmıyor: hat böylece veritabanı olmadan test
 * edilebiliyor (Sprint 1'deki AnalysisStore ile aynı gerekçe).
 */
export interface AdaptationStore {
  getAdaptationContext(adaptationId: string): Promise<AdaptationContext>
  saveDraft(input: {
    adaptationId: string
    draft: AdaptationDraft
    status: "draft" | "ready"
    durationMs: number
    tokenUsage: number
  }): Promise<void>
  failAdaptation(adaptationId: string, errorClass: string): Promise<void>
}

/** Arayüzdeki ilerleme metinleri bu aşamalara karşılık geliyor. */
export type AdaptStage = "yeniden_yaziliyor" | "kontrol_ediliyor" | "tamamlandi"

export interface AdaptPipelineDeps {
  llm: LlmProvider
  embedding: EmbeddingProvider
  store: AdaptationStore
  onProgress?: (stage: AdaptStage) => void
  /** Test edilebilirlik için; üretimde Date.now. */
  now?: () => number
}
```

- [ ] **Adım 3: Hat testini yaz**

`apps/worker/src/adapt-pipeline.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import type {
  AdaptationDraft,
  JobPostingData,
  LlmProvider,
  ResumeProfile,
  ScoreResult,
} from "@uyarla/core"
import { runAdaptation } from "./adapt-pipeline.js"
import type { AdaptationStore } from "./adapt-types.js"

const profil: ResumeProfile = {
  fullName: "Test Aday",
  headline: null,
  summary: "Frontend geliştirici",
  experience: [
    {
      company: "Acme",
      title: "Geliştirici",
      startDate: "2022",
      endDate: "halen",
      bullets: [
        { text: "React ile panel yaptım", sourceRef: "React ile panel yaptım" },
        { text: "Süreyi %40 düşürdüm", sourceRef: "Süreyi %40 düşürdüm" },
      ],
    },
  ],
  education: [],
  skills: ["Excel", "React"],
  languages: [],
  certifications: [],
}

const ilan: JobPostingData = {
  position: "Frontend Geliştirici",
  company: null,
  seniority: null,
  language: "tr",
  requirements: [
    {
      text: "React deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "React", synonyms: [] }],
    },
    {
      text: "Kubernetes deneyimi",
      type: "skill",
      importance: "must",
      concepts: [{ term: "Kubernetes", synonyms: [] }],
    },
  ],
}

const skor: ScoreResult = {
  score: 50,
  missingKeywords: ["Kubernetes"],
  requirements: [
    {
      requirement: ilan.requirements[0]!,
      status: "matched",
      confidence: 1,
      method: "keyword",
      evidence: { text: "React", matchText: "React", kind: "skill", sourceRef: null },
      matchedConcepts: ["React"],
      missingConcepts: [],
    },
    {
      requirement: ilan.requirements[1]!,
      status: "missing",
      confidence: 0,
      method: null,
      evidence: null,
      matchedConcepts: [],
      missingConcepts: ["Kubernetes"],
    },
  ],
}

/** Kaydedilen taslağı yakalayan sahte store. */
function sahteStore() {
  const kayit: { draft?: AdaptationDraft; status?: string; errorClass?: string } = {}
  const store: AdaptationStore = {
    getAdaptationContext: vi.fn(async () => ({ profile: profil, posting: ilan, result: skor })),
    saveDraft: vi.fn(async ({ draft, status }) => {
      kayit.draft = draft
      kayit.status = status
    }),
    failAdaptation: vi.fn(async (_id, errorClass) => {
      kayit.errorClass = errorClass
    }),
  }
  return { store, kayit }
}

/** Her çağrıda verilen metni döndüren sahte model. */
function sahteLlm(map: (girdi: string) => string): LlmProvider {
  return {
    extract: vi.fn(async ({ input }) => ({
      data: { rewritten: map(input) } as never,
      tokens: 10,
    })),
  }
}

/** Her metne aynı vektörü veren sahte embedding — sapma hep 1.0 çıkar. */
const sahteEmbedding = { embed: vi.fn(async (t: string[]) => t.map(() => [1, 0])) }

describe("runAdaptation", () => {
  it("her madde için bir çağrı yapar ve taslağı kaydeder", async () => {
    const { store, kayit } = sahteStore()
    const llm = sahteLlm(() => "yeniden yazıldı")

    await runAdaptation({ llm, embedding: sahteEmbedding, store }, { adaptationId: "a1" })

    // 2 madde + 1 özet = 3 çağrı
    expect(llm.extract).toHaveBeenCalledTimes(3)
    expect(kayit.draft!.bullets).toHaveLength(2)
    expect(kayit.draft!.bullets[0]!.id).toBe("0-0")
  })

  it("becerileri ilana göre sıralar", async () => {
    const { store, kayit } = sahteStore()
    await runAdaptation(
      { llm: sahteLlm(() => "x"), embedding: sahteEmbedding, store },
      { adaptationId: "a1" },
    )
    expect(kayit.draft!.skillOrder).toEqual(["React", "Excel"])
  })

  it("temiz maddeyi accepted, uyarılı maddeyi pending yapar", async () => {
    // K-26: risk tabanlı onay. Doğrulamayı geçen madde tek tıkla geri
    // alınır; uyarı taşıyan madde indirmeyi bloklar.
    const { store, kayit } = sahteStore()
    const llm = sahteLlm((girdi) =>
      girdi.includes("%40") ? "Süreyi %90 düşürdüm" : "React ile paneli geliştirdim",
    )

    await runAdaptation({ llm, embedding: sahteEmbedding, store }, { adaptationId: "a1" })

    expect(kayit.draft!.bullets[0]!.decision).toBe("accepted")
    expect(kayit.draft!.bullets[1]!.decision).toBe("pending")
    expect(kayit.draft!.bullets[1]!.verification.issues[0]!.kind).toBe("number_mismatch")
  })

  it("uyarılı madde varsa durum draft kalır", async () => {
    const { store, kayit } = sahteStore()
    const llm = sahteLlm((girdi) => (girdi.includes("%40") ? "Süreyi %90 düşürdüm" : "yeni"))
    await runAdaptation({ llm, embedding: sahteEmbedding, store }, { adaptationId: "a1" })
    expect(kayit.status).toBe("draft")
  })

  it("hepsi temizse durum ready olur", async () => {
    const { store, kayit } = sahteStore()
    await runAdaptation(
      { llm: sahteLlm(() => "React ile paneli geliştirdim"), embedding: sahteEmbedding, store },
      { adaptationId: "a1" },
    )
    expect(kayit.status).toBe("ready")
  })

  it("bir madde patlarsa o madde orijinal kalır, diğerleri etkilenmez", async () => {
    // spec §13: madde başına izolasyon.
    let sayac = 0
    const llm: LlmProvider = {
      extract: vi.fn(async () => {
        sayac++
        if (sayac === 2) throw new Error("model düştü")
        return { data: { rewritten: "yeni" } as never, tokens: 4 }
      }),
    }
    const { store, kayit } = sahteStore()
    await runAdaptation({ llm, embedding: sahteEmbedding, store }, { adaptationId: "a1" })

    const patlayan = kayit.draft!.bullets.find((b) => b.rewritten === b.original)
    expect(patlayan).toBeDefined()
    expect(patlayan!.verification.issues).toEqual([])
    expect(patlayan!.decision).toBe("accepted")
  })

  it("özeti olmayan CV'de özet çağrısı yapmaz", async () => {
    const { store, kayit } = sahteStore()
    store.getAdaptationContext = vi.fn(async () => ({
      profile: { ...profil, summary: null },
      posting: ilan,
      result: skor,
    }))
    const llm = sahteLlm(() => "yeni")

    await runAdaptation({ llm, embedding: sahteEmbedding, store }, { adaptationId: "a1" })

    expect(llm.extract).toHaveBeenCalledTimes(2)
    expect(kayit.draft!.summary.original).toBeNull()
    expect(kayit.draft!.summary.rewritten).toBe("")
  })

  it("token toplamını kaydeder", async () => {
    const { store } = sahteStore()
    await runAdaptation(
      { llm: sahteLlm(() => "yeni"), embedding: sahteEmbedding, store },
      { adaptationId: "a1" },
    )
    expect(vi.mocked(store.saveDraft).mock.calls[0]![0].tokenUsage).toBe(30)
  })

  it("bağlam okunamazsa uyarlamayı başarısız işaretler ve hatayı yeniden fırlatır", async () => {
    const { store, kayit } = sahteStore()
    store.getAdaptationContext = vi.fn(async () => {
      throw new Error("bulunamadı")
    })

    await expect(
      runAdaptation(
        { llm: sahteLlm(() => "yeni"), embedding: sahteEmbedding, store },
        { adaptationId: "a1" },
      ),
    ).rejects.toThrow("bulunamadı")
    expect(kayit.errorClass).toBe("unknown")
  })

  it("ilerleme aşamalarını sırayla bildirir", async () => {
    const asamalar: string[] = []
    const { store } = sahteStore()
    await runAdaptation(
      {
        llm: sahteLlm(() => "yeni"),
        embedding: sahteEmbedding,
        store,
        onProgress: (s) => asamalar.push(s),
      },
      { adaptationId: "a1" },
    )
    expect(asamalar).toEqual(["yeniden_yaziliyor", "kontrol_ediliyor", "tamamlandi"])
  })
})
```

- [ ] **Adım 4: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/worker test adapt-pipeline`
Beklenen: FAIL — `Cannot find module './adapt-pipeline.js'`

- [ ] **Adım 5: Hattı yaz**

`apps/worker/src/adapt-pipeline.ts`:

```ts
import {
  AdaptationDraftSchema,
  PermanentError,
  TransientError,
  bulletId,
  hasPendingDecisions,
  orderSkillsForPosting,
  rewriteBullets,
  rewriteSummary,
  verifyRewrite,
  type AdaptedBullet,
  type AdaptationDraft,
} from "@uyarla/core"
import type { AdaptPipelineDeps } from "./adapt-types.js"

/**
 * adapt işinin aşama sırası (spec §4):
 * yeniden yazma → doğrulama → taslak kaydı.
 *
 * Yeni bir çıkarım yok: profil ve ilan Sprint 1'de zaten çıkarılmış. Bu
 * hattın tek LLM işi yeniden ifade, ve o da madde başına ayrı çağrıyla.
 */
export async function runAdaptation(
  deps: AdaptPipelineDeps,
  input: { adaptationId: string },
): Promise<void> {
  const now = deps.now ?? Date.now
  const basladi = now()

  try {
    const { profile, posting, result } = await deps.store.getAdaptationContext(
      input.adaptationId,
    )

    deps.onProgress?.("yeniden_yaziliyor")

    // Maddeler düzleştiriliyor: kimlik konumdan türüyor ve taslak profile
    // bu kimlikle geri bağlanıyor (bkz. applyAdaptation).
    const maddeler = profile.experience.flatMap((job, i) =>
      job.bullets.map((bullet, j) => ({
        id: bulletId(i, j),
        experienceIndex: i,
        original: bullet.text,
        sourceRef: bullet.sourceRef,
      })),
    )

    const [yazimlar, ozet] = await Promise.all([
      rewriteBullets(deps.llm, maddeler.map((m) => m.original), posting),
      profile.summary
        ? rewriteSummary(deps.llm, { summary: profile.summary, posting })
        : Promise.resolve(null),
    ])

    deps.onProgress?.("kontrol_ediliyor")

    // Anlamsal sapma için tek toplu gömme çağrısı: önce yeniden yazımlar,
    // sonra kaynaklar. Sıralama aşağıdaki dilimlemeyle eşleşmek zorunda.
    const yeniMetinler = maddeler.map((m, i) => yazimlar[i]?.data ?? m.original)
    const kaynakMetinler = maddeler.map((m) => m.sourceRef)
    const vektorler = await deps.embedding.embed([...yeniMetinler, ...kaynakMetinler])

    const bullets: AdaptedBullet[] = maddeler.map((madde, i) => {
      const yeni = yeniMetinler[i]!
      // Yeniden yazım patladıysa madde orijinal hâliyle kalıyor ve
      // doğrulamaya sokulmuyor: kendi cümlesini uyarmak anlamsız (spec §13).
      const basarisiz = yazimlar[i] === null
      const verification = basarisiz
        ? { status: "ok" as const, issues: [] }
        : verifyRewrite({
            rewritten: yeni,
            source: madde.sourceRef,
            posting,
            vectors: {
              rewritten: vektorler[i]!,
              source: vektorler[maddeler.length + i]!,
            },
          })

      return {
        ...madde,
        rewritten: yeni,
        verification,
        // K-26: risk tabanlı onay. Doğrulamayı geçen madde varsayılan olarak
        // kabul, uyarı taşıyan madde karar bekliyor.
        decision: verification.status === "ok" ? "accepted" : "pending",
      }
    })

    const ozetYazimi = ozet?.data ?? profile.summary ?? ""
    const ozetDogrulama =
      profile.summary && ozet
        ? verifyRewrite({ rewritten: ozetYazimi, source: profile.summary, posting })
        : { status: "ok" as const, issues: [] }

    const draft: AdaptationDraft = AdaptationDraftSchema.parse({
      summary: {
        original: profile.summary,
        rewritten: profile.summary ? ozetYazimi : "",
        verification: ozetDogrulama,
        decision: ozetDogrulama.status === "ok" ? "accepted" : "rejected",
      },
      bullets,
      skillOrder: orderSkillsForPosting(profile.skills, result),
    })

    await deps.store.saveDraft({
      adaptationId: input.adaptationId,
      draft,
      status: hasPendingDecisions(draft) ? "draft" : "ready",
      durationMs: now() - basladi,
      tokenUsage:
        yazimlar.reduce((toplam, y) => toplam + (y?.tokens ?? 0), 0) + (ozet?.tokens ?? 0),
    })

    deps.onProgress?.("tamamlandi")
  } catch (error) {
    try {
      await deps.store.failAdaptation(input.adaptationId, siniflandir(error))
    } catch {
      // Kayıt da düşerse asıl hata gizlenmemeli.
    }
    throw error
  }
}

function siniflandir(error: unknown): string {
  if (error instanceof PermanentError || error instanceof TransientError) return error.code
  return "unknown"
}
```

Not: özetin varsayılan kararı `rejected` — uyarı taşıyan bir özeti
kullanıcının görmediği hâliyle CV'ye koymak yerine orijinali koruyoruz.
Şemada özetin `pending` durumu yok; özet tek parça ve indirmeyi bloklamıyor.

- [ ] **Adım 6: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/worker test adapt-pipeline`
Beklenen: PASS — 10 test geçti.

- [ ] **Adım 7: İlan pozisyonunu şemaya ekle**

`JobPosting` tablosu pozisyon adını tutmuyor — Sprint 1'de ihtiyaç yoktu,
özet prompt'u (Görev 6) istiyor. `packages/db/prisma/schema.prisma`
içindeki `JobPosting` modeline ekle:

```prisma
  position String @default("")
```

`apps/worker/src/store.ts` içindeki `saveJobPostingData`'nın `data` bloğuna
ekle:

```ts
        position: data.position,
```

Migration:

```bash
pnpm --filter @uyarla/db migrate --name sprint2_job_position
```

Not: mevcut kayıtların `position` alanı boş kalıyor. Sprint 1'in eski
analizlerinden uyarlama başlatılırsa özet prompt'u pozisyon adını
göremeyecek; yeni analizler sorunsuz.

- [ ] **Adım 8: Prisma store'u yaz**

`apps/worker/src/adapt-store.ts`:

```ts
import { PermanentError, type AdaptationDraft } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import type { AdaptationStore } from "./adapt-types.js"

/**
 * AdaptationStore'un Prisma uygulaması. Hat bu dosyayı bilmiyor;
 * arayüz üzerinden çağırıyor (bkz. adapt-types.ts).
 */
export const prismaAdaptationStore: AdaptationStore = {
  async getAdaptationContext(adaptationId) {
    const adaptation = await prisma.adaptation.findUnique({
      where: { id: adaptationId },
      include: {
        analysis: { include: { resumeVersion: true, jobPosting: true } },
      },
    })

    if (!adaptation) {
      throw new PermanentError("Uyarlama bulunamadı", "adaptation_not_found")
    }

    const { analysis } = adaptation
    if (!analysis.resumeVersion || !analysis.result) {
      // Analiz başarısız bittiyse uyarlanacak bir şey yok; tekrar denemek
      // aynı sonucu verir.
      throw new PermanentError("Analiz tamamlanmamış", "analysis_incomplete")
    }

    return {
      profile: analysis.resumeVersion.profile as never,
      posting: {
        position: analysis.jobPosting.position,
        company: null,
        seniority: analysis.jobPosting.seniority as never,
        language: analysis.jobPosting.language as never,
        requirements: analysis.jobPosting.requirements as never,
      },
      result: analysis.result as never,
    }
  },

  async saveDraft({ adaptationId, draft, status, durationMs, tokenUsage }) {
    await prisma.adaptation.update({
      where: { id: adaptationId },
      data: { draft: draft as unknown as object, status, durationMs, tokenUsage },
    })
  },

  async failAdaptation(adaptationId, errorClass) {
    await prisma.adaptation.update({
      where: { id: adaptationId },
      data: { status: "failed", errorClass },
    })
  },
}
```

- [ ] **Adım 9: İşçiyi iki kuyruğu dinleyecek hâle getir**

`apps/worker/src/index.ts` sonuna ekle:

```ts
const adaptWorker = new Worker<AdaptJobData, void>(
  ADAPT_QUEUE,
  async (job) => {
    try {
      await runAdaptation(
        {
          llm,
          embedding,
          store: prismaAdaptationStore,
          onProgress: (stage) => void job.updateProgress({ stage }),
        },
        { adaptationId: job.data.adaptationId },
      )
    } catch (error) {
      if (error instanceof PermanentError) throw new UnrecoverableError(error.message)
      throw error
    }
  },
  // Eşzamanlılık 1: bir uyarlama zaten madde başına paralel çağrı yapıyor,
  // ikinci bir katman yerel modeli sıraya sokmaktan başka işe yaramaz (K-16).
  { connection, concurrency: 1 },
)

adaptWorker.on("failed", (job, error) => {
  console.error(`[adapt] iş başarısız: ${job?.id ?? "?"} — ${error.message}`)
})

console.log(`[worker] ${ADAPT_QUEUE} kuyruğu dinleniyor`)
```

Dosyanın başındaki import'lara ekle:

```ts
import { runAdaptation } from "./adapt-pipeline.js"
import { ADAPT_QUEUE, type AdaptJobData } from "./adapt-queue.js"
import { prismaAdaptationStore } from "./adapt-store.js"
```

- [ ] **Adım 10: Testleri çalıştır ve commit**

```bash
pnpm --filter @uyarla/worker test
pnpm --filter @uyarla/worker typecheck
pnpm --filter @uyarla/db migrate:status
git add apps/worker packages/db
git commit -m "feat: uyarlama hattı ve adapt kuyruğu"
```

---

### Görev 9: Belge modeli

Spec §9. Yerleşim kararlarının verildiği tek yer. İki üreteç bunu yalnızca
çiziyor — biri değişince diğeri bozulmasın diye.

**Dosyalar:**
- Oluştur: `packages/core/src/document/model.ts`
- Test: `packages/core/src/document/model.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Sprint 1'den `ResumeProfile`.
- Üretir:
  - `DocumentEntry { heading, subheading, lines }`
  - `DocumentSection { title, entries }`
  - `DocumentModel { name, contact, summary, sections }`
  - `toDocumentModel(profile: ResumeProfile): DocumentModel`
- Görev 10 ve 11 bunu tüketir.

- [ ] **Adım 1: Testi yaz**

`packages/core/src/document/model.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import type { ResumeProfile } from "../schemas/resume.js"
import { toDocumentModel } from "./model.js"

const profil: ResumeProfile = {
  fullName: "Elif Yılmaz",
  headline: "Frontend Geliştirici",
  summary: "React odaklı geliştirici",
  experience: [
    {
      company: "Acme",
      title: "Geliştirici",
      startDate: "2022-01",
      endDate: "halen",
      bullets: [
        { text: "React ile panel geliştirdim", sourceRef: "x" },
        { text: "Test yazdım", sourceRef: "y" },
      ],
    },
  ],
  education: [{ school: "İTÜ", degree: "Lisans", field: "Bilgisayar", endDate: "2021" }],
  skills: ["React", "TypeScript"],
  languages: ["İngilizce (C1)"],
  certifications: ["AWS Cloud Practitioner"],
}

describe("toDocumentModel", () => {
  it("adı ve özeti taşır", () => {
    const m = toDocumentModel(profil)
    expect(m.name).toBe("Elif Yılmaz")
    expect(m.summary).toBe("React odaklı geliştirici")
  })

  it("adı yoksa boş bırakmaz", () => {
    // Adsız bir CV üretmek kullanıcıyı utandırır; başlıksız bir belge
    // ATS'te de kimliksiz kalır.
    expect(toDocumentModel({ ...profil, fullName: null }).name).toBe("İsimsiz")
  })

  it("deneyimi unvan · kurum ve tarih aralığıyla verir", () => {
    const deneyim = toDocumentModel(profil).sections.find((s) => s.title === "DENEYİM")!
    expect(deneyim.entries[0]!.heading).toBe("Geliştirici · Acme")
    expect(deneyim.entries[0]!.subheading).toBe("2022-01 – halen")
    expect(deneyim.entries[0]!.lines).toEqual([
      "React ile panel geliştirdim",
      "Test yazdım",
    ])
  })

  it("standart bölüm başlıkları kullanır", () => {
    // ATS kuralı (spec §9): tarayıcılar bölümleri başlıktan tanıyor.
    expect(toDocumentModel(profil).sections.map((s) => s.title)).toEqual([
      "DENEYİM",
      "EĞİTİM",
      "BECERİLER",
      "DİLLER",
      "SERTİFİKALAR",
    ])
  })

  it("beceri sırasını korur", () => {
    const beceri = toDocumentModel(profil).sections.find((s) => s.title === "BECERİLER")!
    expect(beceri.entries[0]!.lines).toEqual(["React, TypeScript"])
  })

  it("boş bölümü hiç yazmaz", () => {
    const bos = toDocumentModel({ ...profil, languages: [], certifications: [] })
    expect(bos.sections.map((s) => s.title)).toEqual(["DENEYİM", "EĞİTİM", "BECERİLER"])
  })

  it("eğitimde eksik alanları atlar", () => {
    const m = toDocumentModel({
      ...profil,
      education: [{ school: "İTÜ", degree: null, field: null, endDate: null }],
    })
    const egitim = m.sections.find((s) => s.title === "EĞİTİM")!
    expect(egitim.entries[0]!.heading).toBe("İTÜ")
    expect(egitim.entries[0]!.subheading).toBeNull()
  })

  it("özet yoksa null bırakır", () => {
    expect(toDocumentModel({ ...profil, summary: null }).summary).toBeNull()
  })

  it("başlığı iletişim satırı olarak kullanır", () => {
    expect(toDocumentModel(profil).contact).toBe("Frontend Geliştirici")
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test document/model`
Beklenen: FAIL — `Cannot find module './model.js'`

- [ ] **Adım 3: Uygula**

`packages/core/src/document/model.ts`:

```ts
import type { ResumeProfile } from "../schemas/resume.js"

export interface DocumentEntry {
  heading: string | null
  subheading: string | null
  lines: string[]
}

export interface DocumentSection {
  title: string
  entries: DocumentEntry[]
}

/**
 * Yerleşimden bağımsız belge yapısı (spec §9).
 *
 * Yerleşim kararları burada veriliyor, üreteçler yalnızca çiziyor. PDF ile
 * DOCX'in ayrı ayrı "unvanı nasıl yazalım" kararı vermesi, ikisinin zamanla
 * birbirinden ayrışması demek olurdu.
 */
export interface DocumentModel {
  name: string
  contact: string | null
  summary: string | null
  sections: DocumentSection[]
}

export function toDocumentModel(profile: ResumeProfile): DocumentModel {
  const sections: DocumentSection[] = []

  if (profile.experience.length > 0) {
    sections.push({
      title: "DENEYİM",
      entries: profile.experience.map((job) => ({
        heading: `${job.title} · ${job.company}`,
        subheading: `${job.startDate} – ${job.endDate}`,
        lines: job.bullets.map((b) => b.text),
      })),
    })
  }

  if (profile.education.length > 0) {
    sections.push({
      title: "EĞİTİM",
      entries: profile.education.map((edu) => ({
        heading: [edu.school, edu.degree, edu.field].filter(Boolean).join(" · "),
        subheading: edu.endDate,
        lines: [],
      })),
    })
  }

  // Beceriler tek satırda virgülle: ATS tarayıcıları bu biçimi en güvenilir
  // ayrıştırıyor ve madde listesi belgeyi gereksiz uzatıyor.
  if (profile.skills.length > 0) {
    sections.push({
      title: "BECERİLER",
      entries: [{ heading: null, subheading: null, lines: [profile.skills.join(", ")] }],
    })
  }

  if (profile.languages.length > 0) {
    sections.push({
      title: "DİLLER",
      entries: [{ heading: null, subheading: null, lines: [profile.languages.join(", ")] }],
    })
  }

  if (profile.certifications.length > 0) {
    sections.push({
      title: "SERTİFİKALAR",
      entries: [
        { heading: null, subheading: null, lines: profile.certifications },
      ],
    })
  }

  return {
    // Adsız belge üretmiyoruz: başlıksız bir CV ATS'te kimliksiz kalır.
    name: profile.fullName ?? "İsimsiz",
    contact: profile.headline,
    summary: profile.summary,
    sections,
  }
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test document/model`
Beklenen: PASS — 9 test geçti.

- [ ] **Adım 5: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./document/model.js"
```

```bash
pnpm --filter @uyarla/core test
git add packages/core
git commit -m "feat: belge modeli"
```

---

### Görev 10: PDF üreteci

Spec §9. Tarayıcı kullanılmıyor: `pdfkit` ile doğrudan yazmak hem hafif hem
metnin seçilebilir olmasını garantiliyor.

**Dikkat — Türkçe karakter tuzağı.** `pdfkit`'in gömülü Helvetica'sı
WinAnsi kodlaması kullanıyor ve `ş ğ ı İ` bu kodlamada **yok**. Adım 1 bunu
ölçüyor; ölçüm bozuk çıkarsa (beklenen bu) Türkçe kapsayan bir TTF gömülür.
Bu, spec §9'un "sistem fontu" kuralıyla çelişmiyor: kural marka fontunu
yasaklıyor, ATS'in derdi metin katmanının okunabilirliği — ve gömülü DejaVu
Sans sıradan bir sans-serif.

**Dosyalar:**
- Oluştur: `packages/core/src/document/pdf.ts`
- Test: `packages/core/src/document/pdf.test.ts`
- Değiştir: `packages/core/package.json` (`pdfkit`, `@types/pdfkit`, `dejavu-fonts-ttf`)
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Görev 9'dan `DocumentModel`; Sprint 1'den `extractText`.
- Üretir: `renderPdf(model: DocumentModel): Promise<Buffer>`
- Görev 12 bunu çağırır.

- [ ] **Adım 1: Bağımlılıkları kur ve Türkçe karakteri ölç**

```bash
pnpm --filter @uyarla/core add pdfkit dejavu-fonts-ttf
pnpm --filter @uyarla/core add -D @types/pdfkit
```

Ölçüm betiği — `/tmp/pdf-turkce.mjs`:

```js
import PDFDocument from "pdfkit"
import { PDFParse } from "pdf-parse"

const doc = new PDFDocument()
const parcalar = []
doc.on("data", (p) => parcalar.push(p))
const bitti = new Promise((r) => doc.on("end", r))
doc.font("Helvetica").fontSize(12).text("Şeyma Çağlar ığüöş İSTANBUL")
doc.end()
await bitti

const parser = new PDFParse({ data: Buffer.concat(parcalar) })
console.log(JSON.stringify((await parser.getText()).text))
await parser.destroy()
```

Çalıştır: `cd packages/core && node /tmp/pdf-turkce.mjs`

Beklenen: Türkçe harfler bozuk ya da eksik. Çıktıyı not et — Adım 3'teki
font kararının gerekçesi bu ölçüm.

- [ ] **Adım 2: Testi yaz**

`packages/core/src/document/pdf.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { extractText } from "../documents/extractText.js"
import type { DocumentModel } from "./model.js"
import { renderPdf } from "./pdf.js"

const model: DocumentModel = {
  name: "Elif Yılmaz",
  contact: "Frontend Geliştirici",
  summary: "React odaklı geliştirici",
  sections: [
    {
      title: "DENEYİM",
      entries: [
        {
          heading: "Geliştirici · Acme",
          subheading: "2022-01 – halen",
          lines: ["React ile panel geliştirdim", "Test altyapısını kurdum"],
        },
      ],
    },
    {
      title: "BECERİLER",
      entries: [{ heading: null, subheading: null, lines: ["React, TypeScript"] }],
    },
  ],
}

describe("renderPdf", () => {
  it("geçerli bir PDF üretir", async () => {
    const pdf = await renderPdf(model)
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })

  it("metin katmanı seçilebilir — kendi çıkarıcımızla okunuyor", async () => {
    // Tamamlanma tanımı bunu şart koşuyor (spec §14): taranmış görüntüye
    // benzeyen bir PDF ATS'ten geçmez.
    const metin = await extractText(await renderPdf(model), "cikti.pdf")
    expect(metin).toContain("React ile panel geliştirdim")
  })

  it("Türkçe karakterleri bozmadan yazar", async () => {
    // pdfkit'in gömülü Helvetica'sı WinAnsi kullanıyor ve ş/ğ/ı/İ orada yok.
    const metin = await extractText(await renderPdf(model), "cikti.pdf")
    expect(metin).toContain("Elif Yılmaz")
    expect(metin).toContain("Geliştirici")
  })

  it("bütün bölümleri ve maddeleri yazar", async () => {
    const metin = await extractText(await renderPdf(model), "cikti.pdf")
    for (const beklenen of [
      "DENEYİM",
      "BECERİLER",
      "Geliştirici · Acme",
      "2022-01 – halen",
      "Test altyapısını kurdum",
      "React, TypeScript",
    ]) {
      expect(metin).toContain(beklenen)
    }
  })

  it("özeti yazar", async () => {
    expect(await extractText(await renderPdf(model), "cikti.pdf")).toContain(
      "React odaklı geliştirici",
    )
  })

  it("özet yoksa çökmez", async () => {
    const pdf = await renderPdf({ ...model, summary: null, contact: null })
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })

  it("uzun içerikte ikinci sayfaya taşar", async () => {
    const uzun: DocumentModel = {
      ...model,
      sections: [
        {
          title: "DENEYİM",
          entries: Array.from({ length: 40 }, (_, i) => ({
            heading: `Rol ${i} · Şirket ${i}`,
            subheading: "2020 – 2021",
            lines: ["Bir şeyler geliştirdim", "Başka şeyler geliştirdim"],
          })),
        },
      ],
    }
    const metin = await extractText(await renderPdf(uzun), "cikti.pdf")
    expect(metin).toContain("Rol 39 · Şirket 39")
  })

  it("bölümsüz modelde de geçerli PDF üretir", async () => {
    const pdf = await renderPdf({ ...model, sections: [] })
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })
})
```

- [ ] **Adım 3: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test document/pdf`
Beklenen: FAIL — `Cannot find module './pdf.js'`

- [ ] **Adım 4: Uygula**

`packages/core/src/document/pdf.ts`:

```ts
import { createRequire } from "node:module"
import PDFDocument from "pdfkit"
import type { DocumentModel } from "./model.js"

const require = createRequire(import.meta.url)

/**
 * Türkçe kapsayan gömülü font.
 *
 * pdfkit'in gömülü Helvetica'sı WinAnsi kodlaması kullanıyor ve `ş ğ ı İ`
 * bu kodlamada yok — Türkçe bir CV'de yazı bozuluyor. DejaVu Sans sıradan
 * bir sans-serif ve serbest lisanslı; ATS'in istediği "metin katmanı
 * okunabilir olsun" kuralına aykırı değil (spec §9).
 */
const FONT = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf")
const FONT_BOLD = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf")

const KENAR = 56 // ~2 cm

/**
 * ATS dostu tek sütunlu PDF (spec §9).
 *
 * Tablo yok, metin kutusu yok, üstbilgi/altbilgi yok, grafik yok. Tarayıcı
 * kullanılmıyor: Puppeteer worker'a yüzlerce megabayt ekler ve bu yerleşim
 * onu gerektirmiyor.
 */
export async function renderPdf(model: DocumentModel): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: KENAR })
  doc.registerFont("govde", FONT)
  doc.registerFont("kalin", FONT_BOLD)

  const parcalar: Buffer[] = []
  doc.on("data", (parca: Buffer) => parcalar.push(parca))
  const bitti = new Promise<void>((resolve) => doc.on("end", () => resolve()))

  doc.font("kalin").fontSize(20).text(model.name)
  if (model.contact) doc.font("govde").fontSize(10).fillColor("#444").text(model.contact)
  doc.fillColor("#000")

  if (model.summary) {
    doc.moveDown(0.8).font("govde").fontSize(10).text(model.summary, { align: "left" })
  }

  for (const section of model.sections) {
    doc.moveDown(1).font("kalin").fontSize(11).text(section.title)
    // İnce bir çizgi; grafik değil, bölüm ayracı. ATS metin katmanını
    // etkilemiyor.
    doc
      .moveTo(KENAR, doc.y + 2)
      .lineTo(doc.page.width - KENAR, doc.y + 2)
      .strokeColor("#999")
      .lineWidth(0.5)
      .stroke()
    doc.moveDown(0.5)

    for (const entry of section.entries) {
      if (entry.heading) doc.font("kalin").fontSize(10).text(entry.heading)
      if (entry.subheading) {
        doc.font("govde").fontSize(9).fillColor("#555").text(entry.subheading)
        doc.fillColor("#000")
      }
      for (const line of entry.lines) {
        doc.font("govde").fontSize(10).text(`• ${line}`, { indent: 8 })
      }
      doc.moveDown(0.5)
    }
  }

  doc.end()
  await bitti
  return Buffer.concat(parcalar)
}
```

- [ ] **Adım 5: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test document/pdf`
Beklenen: PASS — 8 test geçti. Özellikle "Türkçe karakterleri bozmadan
yazar" testi Adım 1'deki ölçümün karşılığı.

- [ ] **Adım 6: Çıktıyı gözle incele**

```bash
cd packages/core && npx tsx -e "
import { renderPdf } from './src/document/pdf.js'
import { toDocumentModel } from './src/document/model.js'
import { readFileSync, writeFileSync } from 'node:fs'
const profil = JSON.parse(readFileSync('eval/cache/cv-a-ai-engineer.json','utf8'))
writeFileSync('/tmp/ornek.pdf', await renderPdf(toDocumentModel(profil)))
" && open /tmp/ornek.pdf
```

Kontrol et: tek sütun mu, Türkçe harfler doğru mu, metin seçilebiliyor mu,
sayfa taşması makul mü.

- [ ] **Adım 7: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./document/pdf.js"
```

```bash
pnpm --filter @uyarla/core test
pnpm --filter @uyarla/core typecheck
git add packages/core ../../pnpm-lock.yaml
git commit -m "feat: ATS dostu PDF üreteci"
```

---

### Görev 11: DOCX üreteci

Spec §9. Aynı ara yapıdan ikinci üreteç. Türkiye'deki kurumsal İK
süreçlerinde DOCX hâlâ yaygın (K-29).

**Dosyalar:**
- Oluştur: `packages/core/src/document/docx.ts`
- Test: `packages/core/src/document/docx.test.ts`
- Değiştir: `packages/core/package.json` (`docx`)
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Görev 9'dan `DocumentModel`; Sprint 1'den `extractText`.
- Üretir: `renderDocx(model: DocumentModel): Promise<Buffer>`
- Görev 12 bunu çağırır.

- [ ] **Adım 1: Bağımlılığı kur**

```bash
pnpm --filter @uyarla/core add docx
```

- [ ] **Adım 2: Testi yaz**

`packages/core/src/document/docx.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { extractText } from "../documents/extractText.js"
import type { DocumentModel } from "./model.js"
import { renderDocx } from "./docx.js"

const model: DocumentModel = {
  name: "Elif Yılmaz",
  contact: "Frontend Geliştirici",
  summary: "React odaklı geliştirici",
  sections: [
    {
      title: "DENEYİM",
      entries: [
        {
          heading: "Geliştirici · Acme",
          subheading: "2022-01 – halen",
          lines: ["React ile panel geliştirdim", "Test altyapısını kurdum"],
        },
      ],
    },
    {
      title: "BECERİLER",
      entries: [{ heading: null, subheading: null, lines: ["React, TypeScript"] }],
    },
  ],
}

describe("renderDocx", () => {
  it("geçerli bir DOCX üretir", async () => {
    // DOCX bir zip; imzası PK.
    const buf = await renderDocx(model)
    expect(buf.subarray(0, 2).toString()).toBe("PK")
  })

  it("metni kendi çıkarıcımızla okunabiliyor", async () => {
    const metin = await extractText(await renderDocx(model), "cikti.docx")
    expect(metin).toContain("React ile panel geliştirdim")
  })

  it("Türkçe karakterleri bozmadan yazar", async () => {
    const metin = await extractText(await renderDocx(model), "cikti.docx")
    expect(metin).toContain("Elif Yılmaz")
    expect(metin).toContain("Geliştirici")
  })

  it("PDF ile aynı içeriği yazar", async () => {
    // İki üreteç tek modelden besleniyor; içerik ayrışırsa model değil
    // üreteçler karar veriyor demektir.
    const metin = await extractText(await renderDocx(model), "cikti.docx")
    for (const beklenen of [
      "DENEYİM",
      "BECERİLER",
      "Geliştirici · Acme",
      "2022-01 – halen",
      "Test altyapısını kurdum",
      "React, TypeScript",
      "React odaklı geliştirici",
    ]) {
      expect(metin).toContain(beklenen)
    }
  })

  it("özet ve iletişim yoksa çökmez", async () => {
    const buf = await renderDocx({ ...model, summary: null, contact: null })
    expect(buf.subarray(0, 2).toString()).toBe("PK")
  })

  it("bölümsüz modelde de geçerli DOCX üretir", async () => {
    const buf = await renderDocx({ ...model, sections: [] })
    expect(buf.subarray(0, 2).toString()).toBe("PK")
  })
})
```

- [ ] **Adım 3: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test document/docx`
Beklenen: FAIL — `Cannot find module './docx.js'`

- [ ] **Adım 4: Uygula**

`packages/core/src/document/docx.ts`:

```ts
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from "docx"
import type { DocumentModel } from "./model.js"

/** Marka rehberi §9.3: CV çıktısında marka fontu değil sistem fontu. */
const FONT = "Calibri"

/**
 * ATS dostu DOCX (spec §9).
 *
 * PDF ile aynı `DocumentModel`'den besleniyor: yerleşim kararları modelde,
 * bu dosya yalnızca çiziyor. Tablo, metin kutusu, üstbilgi/altbilgi yok.
 */
export async function renderDocx(model: DocumentModel): Promise<Buffer> {
  const paragraflar: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: model.name, bold: true, size: 40, font: FONT })],
    }),
  ]

  if (model.contact) {
    paragraflar.push(
      new Paragraph({
        children: [new TextRun({ text: model.contact, size: 20, font: FONT, color: "444444" })],
      }),
    )
  }

  if (model.summary) {
    paragraflar.push(
      new Paragraph({
        spacing: { before: 160 },
        children: [new TextRun({ text: model.summary, size: 20, font: FONT })],
      }),
    )
  }

  for (const section of model.sections) {
    paragraflar.push(
      new Paragraph({
        spacing: { before: 280, after: 80 },
        // Alt çizgi yerine kenarlık: tablo kullanmadan bölüm ayracı.
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 2 } },
        children: [new TextRun({ text: section.title, bold: true, size: 22, font: FONT })],
      }),
    )

    for (const entry of section.entries) {
      if (entry.heading) {
        paragraflar.push(
          new Paragraph({
            children: [new TextRun({ text: entry.heading, bold: true, size: 20, font: FONT })],
          }),
        )
      }
      if (entry.subheading) {
        paragraflar.push(
          new Paragraph({
            children: [
              new TextRun({ text: entry.subheading, size: 18, font: FONT, color: "555555" }),
            ],
          }),
        )
      }
      for (const line of entry.lines) {
        paragraflar.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: line, size: 20, font: FONT })],
          }),
        )
      }
    }
  }

  const doc = new Document({ sections: [{ children: paragraflar }] })
  return Packer.toBuffer(doc)
}
```

- [ ] **Adım 5: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test document/`
Beklenen: PASS — 23 test geçti (model 9, PDF 8, DOCX 6).

- [ ] **Adım 6: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./document/docx.js"
```

```bash
pnpm --filter @uyarla/core test
pnpm --filter @uyarla/core typecheck
git add packages/core ../../pnpm-lock.yaml
git commit -m "feat: DOCX üreteci"
```

---

### Görev 12: API route'ları ve indirme kapısı

Spec §8. Dört route. En kritik olanı indirme kapısı: uyarı taşıyan bir madde
karara bağlanmadan belge üretilmez — bu, spec §16'da "asla kesilmeyecek"
listesinde.

**Yeni skor nerede hesaplanıyor:** GET ve PATCH route'larında, `rescore` ile.
Veritabanında saklanmıyor çünkü her karar değişikliğinde bayatlıyor ve
hesaplaması yalnızca bir toplu gömme çağrısı — LLM yok (spec §10).

**Dosyalar:**
- Oluştur: `apps/web/lib/adaptQueue.ts`
- Oluştur: `apps/web/lib/adaptation.ts`
- Oluştur: `apps/web/app/api/adapt/route.ts`
- Oluştur: `apps/web/app/api/adapt/[id]/route.ts`
- Oluştur: `apps/web/app/api/adapt/[id]/decision/route.ts`
- Oluştur: `apps/web/app/api/adapt/[id]/download/route.ts`
- Test: `apps/web/lib/adaptation.test.ts`
- Değiştir: `apps/web/next.config.mjs` (`serverExternalPackages`)
- Değiştir: `apps/web/package.json` (`@uyarla/core` zaten var; yenisi yok)

**Arayüzler:**
- Tüketir: Görev 1, 7, 9, 10, 11; Görev 8'den `ADAPT_QUEUE`, `AdaptJobData`,
  `ADAPT_JOB_OPTIONS`.
- Üretir:
  - `adaptQueue: Queue<AdaptJobData, void>`
  - `applyDecision(draft: AdaptationDraft, itemId: string, decision: "accepted" | "rejected"): AdaptationDraft`
  - `nextStatus(draft: AdaptationDraft): "draft" | "ready"`
  - Dört HTTP route
- Görev 13 bu route'ları tüketir.

- [ ] **Adım 1: Karar uygulama testini yaz**

`apps/web/lib/adaptation.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import type { AdaptationDraft } from "@uyarla/core"
import { applyDecision, nextStatus } from "./adaptation"

const taslak: AdaptationDraft = {
  summary: {
    original: "eski", rewritten: "yeni",
    verification: { status: "ok", issues: [] }, decision: "accepted",
  },
  bullets: [
    {
      id: "0-0", experienceIndex: 0, original: "a", sourceRef: "a", rewritten: "A",
      verification: { status: "ok", issues: [] }, decision: "accepted",
    },
    {
      id: "0-1", experienceIndex: 0, original: "b", sourceRef: "b", rewritten: "B",
      verification: {
        status: "flagged",
        issues: [{ kind: "number_mismatch", detail: "…" }],
      },
      decision: "pending",
    },
  ],
  skillOrder: ["React"],
}

describe("applyDecision", () => {
  it("maddenin kararını değiştirir", () => {
    const yeni = applyDecision(taslak, "0-1", "accepted")
    expect(yeni.bullets[1]!.decision).toBe("accepted")
  })

  it("diğer maddelere dokunmaz", () => {
    expect(applyDecision(taslak, "0-1", "rejected").bullets[0]!.decision).toBe("accepted")
  })

  it("summary kimliğiyle özetin kararını değiştirir", () => {
    expect(applyDecision(taslak, "summary", "rejected").summary.decision).toBe("rejected")
  })

  it("bilinmeyen kimlikte hata fırlatır", () => {
    // Sessizce yok saymak, kullanıcının tıkladığı kararın kaybolması demek.
    expect(() => applyDecision(taslak, "yok", "accepted")).toThrow(/bulunamadı/i)
  })

  it("girdi taslağını değiştirmez", () => {
    applyDecision(taslak, "0-1", "accepted")
    expect(taslak.bullets[1]!.decision).toBe("pending")
  })
})

describe("nextStatus", () => {
  it("bekleyen karar varsa draft", () => {
    expect(nextStatus(taslak)).toBe("draft")
  })

  it("bekleyen karar yoksa ready", () => {
    expect(nextStatus(applyDecision(taslak, "0-1", "rejected"))).toBe("ready")
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/web test lib/adaptation`
Beklenen: FAIL — `Cannot find module './adaptation'`

- [ ] **Adım 3: Yardımcıyı yaz**

`apps/web/lib/adaptation.ts`:

```ts
import { hasPendingDecisions, type AdaptationDraft } from "@uyarla/core"

/**
 * Tek bir maddenin (ya da özetin) kararını değiştirir.
 *
 * Taslağı yerinde değiştirmiyor: aynı nesne hem okunup hem yazılırsa
 * eşzamanlı iki karar birbirini eziyor.
 */
export function applyDecision(
  draft: AdaptationDraft,
  itemId: string,
  decision: "accepted" | "rejected",
): AdaptationDraft {
  if (itemId === "summary") {
    return { ...draft, summary: { ...draft.summary, decision } }
  }

  const bulundu = draft.bullets.some((b) => b.id === itemId)
  if (!bulundu) {
    // Sessizce yok saymak, kullanıcının tıkladığı kararın kaybolması olurdu.
    throw new Error(`Madde bulunamadı: ${itemId}`)
  }

  return {
    ...draft,
    bullets: draft.bullets.map((b) => (b.id === itemId ? { ...b, decision } : b)),
  }
}

/** Uyarı taşıyan madde kaldıysa `draft`, kalmadıysa `ready` (K-26). */
export function nextStatus(draft: AdaptationDraft): "draft" | "ready" {
  return hasPendingDecisions(draft) ? "draft" : "ready"
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/web test lib/adaptation`
Beklenen: PASS — 7 test geçti.

- [ ] **Adım 5: Kuyruğun üretici tarafını yaz**

`apps/web/lib/adaptQueue.ts`:

```ts
import { ADAPT_QUEUE, type AdaptJobData } from "@uyarla/worker/adapt-queue"
import { Queue } from "bullmq"
import IORedis from "ioredis"

const globalForQueue = globalThis as unknown as { adaptQueue?: Queue<AdaptJobData, void> }

/**
 * Next geliştirme modunda modülleri yeniden yüklüyor; global'de saklanmazsa
 * her yeniden yüklemede yeni bir Redis bağlantısı açılır (bkz. lib/queue.ts).
 */
export const adaptQueue =
  globalForQueue.adaptQueue ??
  new Queue<AdaptJobData, void>(ADAPT_QUEUE, {
    connection: new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    }),
  })

if (process.env.NODE_ENV !== "production") globalForQueue.adaptQueue = adaptQueue
```

- [ ] **Adım 6: Başlatma route'unu yaz**

`apps/web/app/api/adapt/route.ts`:

```ts
import { PermanentError } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { ADAPT_JOB_OPTIONS } from "@uyarla/worker/adapt-queue"
import { NextResponse } from "next/server"
import { adaptQueue } from "@/lib/adaptQueue"

export const runtime = "nodejs"

/**
 * Uyarlama başlatır. Kayıt burada açılıyor, worker'da değil: kararlar ve
 * indirme de aynı kaydı adresliyor ve arayüzün beklemeden bir kimliğe
 * ihtiyacı var.
 */
export async function POST(request: Request) {
  try {
    const { analysisId } = (await request.json()) as { analysisId?: string }
    if (!analysisId) throw new PermanentError("Analiz kimliği gerekli.", "missing_analysis")

    const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } })
    if (!analysis) throw new PermanentError("Analiz bulunamadı.", "analysis_not_found")
    if (analysis.status !== "done") {
      throw new PermanentError("Bu analiz henüz tamamlanmadı.", "analysis_incomplete")
    }

    // analysisId benzersiz: bir analizin tek uyarlaması olur (spec §5).
    // Varsa yeniden çalıştırmak yerine mevcut kaydı döndürüyoruz.
    const mevcut = await prisma.adaptation.findUnique({ where: { analysisId } })
    if (mevcut) return NextResponse.json({ adaptationId: mevcut.id })

    const adaptation = await prisma.adaptation.create({
      data: { analysisId, draft: {}, modelId: analysis.modelId, status: "running" },
    })

    await adaptQueue.add("adapt", { adaptationId: adaptation.id }, ADAPT_JOB_OPTIONS)

    return NextResponse.json({ adaptationId: adaptation.id })
  } catch (error) {
    if (error instanceof PermanentError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    console.error("[api/adapt]", error)
    return NextResponse.json(
      { error: "Bir şeyler ters gitti. Birazdan tekrar dener misin?", code: "unknown" },
      { status: 500 },
    )
  }
}
```

- [ ] **Adım 7: Ortak yükleyiciyi ve durum route'unu yaz**

`apps/web/lib/adaptation.ts` içindeki import satırını genişlet:

```ts
import {
  AdaptationDraftSchema,
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
  hasPendingDecisions,
  rescore,
  type AdaptationDraft,
  type JobPostingData,
  type ResumeProfile,
} from "@uyarla/core"
import { prisma } from "@uyarla/db"
```

Ve dosyanın sonuna ekle:

```ts
/** Uyarlama kaydı ve dayandığı Sprint 1 verisi. */
export async function loadAdaptation(id: string) {
  const adaptation = await prisma.adaptation.findUnique({
    where: { id },
    include: { analysis: { include: { resumeVersion: true, jobPosting: true } } },
  })
  if (!adaptation) return null

  const { analysis } = adaptation
  const profile = (analysis.resumeVersion?.profile ?? null) as ResumeProfile | null
  const posting: JobPostingData = {
    position: analysis.jobPosting.position,
    company: null,
    seniority: analysis.jobPosting.seniority as never,
    language: analysis.jobPosting.language as never,
    requirements: analysis.jobPosting.requirements as never,
  }

  // Kayıt henüz yazılmamışken draft boş bir nesne; parse etmeye çalışmıyoruz.
  const draft: AdaptationDraft | null =
    adaptation.status === "running" || adaptation.status === "failed"
      ? null
      : AdaptationDraftSchema.parse(adaptation.draft)

  return {
    adaptation,
    profile,
    posting,
    draft,
    scoreBefore: analysis.score,
    /** Nihai ResumeVersion'ın bağlanacağı CV; indirme route'u kullanıyor. */
    resumeId: analysis.resumeVersion?.resumeId ?? null,
  }
}

/** Kabul edilen içerikten yeni skoru hesaplar; taslak yoksa null. */
export async function computeScoreAfter(
  profile: ResumeProfile | null,
  posting: JobPostingData,
  draft: AdaptationDraft | null,
): Promise<number | null> {
  if (!profile || !draft) return null
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  return rescore({ profile, posting, draft }, embedding)
}
```

`apps/web/app/api/adapt/[id]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { computeScoreAfter, loadAdaptation } from "@/lib/adaptation"

export const runtime = "nodejs"

/** Durum ve çalışma belgesi. Arayüz çalışırken bunu saniyede bir yokluyor. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const yuk = await loadAdaptation(id)
  if (!yuk) return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })

  const { adaptation, profile, posting, draft, scoreBefore } = yuk

  return NextResponse.json({
    status: adaptation.status,
    draft,
    scoreBefore,
    // Yeni skor yalnızca taslak varken hesaplanıyor; çalışırken boşuna
    // gömme çağrısı yapılmaz.
    scoreAfter: await computeScoreAfter(profile, posting, draft),
    errorClass: adaptation.errorClass,
  })
}
```

- [ ] **Adım 8: Karar route'unu yaz**

`apps/web/app/api/adapt/[id]/decision/route.ts`:

```ts
import { AdaptationDraftSchema } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { applyDecision, computeScoreAfter, loadAdaptation, nextStatus } from "@/lib/adaptation"

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { itemId, decision } = (await request.json()) as {
    itemId?: string
    decision?: "accepted" | "rejected"
  }

  if (!itemId || (decision !== "accepted" && decision !== "rejected")) {
    return NextResponse.json({ error: "Geçersiz karar." }, { status: 400 })
  }

  const yuk = await loadAdaptation(id)
  if (!yuk?.draft) {
    return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
  }

  let yeni
  try {
    yeni = applyDecision(yuk.draft, itemId, decision)
  } catch {
    return NextResponse.json({ error: "Madde bulunamadı." }, { status: 404 })
  }

  const status = nextStatus(yeni)
  await prisma.adaptation.update({
    where: { id },
    data: { draft: AdaptationDraftSchema.parse(yeni) as unknown as object, status },
  })

  return NextResponse.json({
    status,
    draft: yeni,
    scoreAfter: await computeScoreAfter(yuk.profile, yuk.posting, yeni),
  })
}
```

- [ ] **Adım 9: İndirme route'unu yaz**

`apps/web/app/api/adapt/[id]/download/route.ts`:

```ts
import { applyAdaptation, hasPendingDecisions, toDocumentModel } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { loadAdaptation } from "@/lib/adaptation"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const format = new URL(request.url).searchParams.get("format") === "docx" ? "docx" : "pdf"

  const yuk = await loadAdaptation(id)
  if (!yuk?.draft || !yuk.profile || !yuk.resumeId) {
    return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })
  }

  // İndirme kapısı (spec §8, §16'da "asla kesilmeyecek"): uyarı taşıyan bir
  // madde karara bağlanmadan belge üretilmez.
  if (hasPendingDecisions(yuk.draft)) {
    return NextResponse.json(
      {
        error: "Önce işaretli maddeler için karar ver. Sonra indirebilirsin.",
        code: "pending_decisions",
      },
      { status: 409 },
    )
  }

  const uyarlanmis = applyAdaptation(yuk.profile, yuk.draft)

  // Nihai eser burada doğuyor: indirilen belge tam olarak onaylanan hâl
  // (spec §4). Çalışma hâli (draft) ile nihai sürüm farklı şeyler.
  const mevcut = await prisma.resumeVersion.count({ where: { resumeId: yuk.resumeId! } })
  const version = await prisma.resumeVersion.create({
    data: {
      resumeId: yuk.resumeId!,
      profile: uyarlanmis as unknown as object,
      source: "adapted",
      versionNo: mevcut + 1,
    },
  })
  await prisma.adaptation.update({
    where: { id },
    data: { resumeVersionId: version.id },
  })

  const model = toDocumentModel(uyarlanmis)

  // Tembel import: pdfkit ve docx ağır bağımlılıklar, ve Sprint 1'de
  // pdf-parse'ın Next sunucu katmanında üst seviyeden yüklenemediğini
  // görmüştük. Yalnızca indirme anında yükleniyorlar.
  const { renderPdf } = await import("@uyarla/core/document/pdf")
  const { renderDocx } = await import("@uyarla/core/document/docx")

  const buffer = format === "docx" ? await renderDocx(model) : await renderPdf(model)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        format === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf",
      "Content-Disposition": `attachment; filename="uyarla-cv.${format}"`,
    },
  })
}
```

`packages/core/package.json` `exports` bloğuna alt yol ekle:

```json
    "./document/pdf": "./src/document/pdf.ts",
    "./document/docx": "./src/document/docx.ts"
```

`apps/web/next.config.mjs` içindeki `serverExternalPackages` dizisine ekle:

```js
"pdfkit", "docx"
```

- [ ] **Adım 10: Uçtan uca elle dene**

Üç süreci başlat (Postgres/Redis, worker, web), `/test` sayfasından bir
analiz çalıştır, sonra:

```bash
ANALIZ=<analiz-kimligi>
curl -s -X POST localhost:3000/api/adapt -H 'content-type: application/json' \
  -d "{\"analysisId\":\"$ANALIZ\"}"
# → {"adaptationId":"..."}

UYARLAMA=<uyarlama-kimligi>
curl -s "localhost:3000/api/adapt/$UYARLAMA" | head -c 600
# uyarı taşıyan bir madde varken indirme kapalı olmalı:
curl -s -o /dev/null -w "%{http_code}\n" "localhost:3000/api/adapt/$UYARLAMA/download"
# → 409

curl -s -X PATCH "localhost:3000/api/adapt/$UYARLAMA/decision" \
  -H 'content-type: application/json' -d '{"itemId":"0-1","decision":"rejected"}'

curl -s "localhost:3000/api/adapt/$UYARLAMA/download?format=pdf" -o /tmp/uyarla.pdf
open /tmp/uyarla.pdf
```

Beklenen: uyarı varken 409, karar sonrası geçerli PDF. `scoreBefore` ve
`scoreAfter` dolu geliyor.

- [ ] **Adım 11: Testleri çalıştır ve commit**

```bash
pnpm --filter @uyarla/web test
pnpm --filter @uyarla/web typecheck
pnpm --filter @uyarla/web build
git add apps/web packages/core
git commit -m "feat: uyarlama API route'ları ve indirme kapısı"
```

---

### Görev 13: Marka giydirmesi ve uyarlama ekranı

Spec §11. Marka giydirmesi Sprint 1'de bilinçli olarak ertelenmişti (K-01);
şimdi yapılıyor çünkü kullanılabilirlik testi bu sprintte ve stilsiz bir
arayüzle test etmek yanıltıcı geri bildirim üretir.

**Marka rehberinden bağlayıcı olanlar:**

| Öğe | Değer |
|---|---|
| Uyarla Mavisi | `#2B4EFF` — birincil eylem, her ekranda tek |
| Gece | `#0F172A` — metin, koyu tema zemini |
| Buz | `#F5F7FF` — açık tema zemini |
| Mercan | `#FF6B4A` — yalnızca vurgu etiketi |
| Yeşil / Kehribar / Kırmızı | `#16A34A` / `#F59E0B` / `#DC2626` — yalnızca durum |
| Gri | `#64748B` — ikincil metin |
| Font | Manrope (başlık) · Inter (metin) |
| Yarıçap | Buton 10 px · kart 16 px |
| Skor | Ekranın en büyük öğesi; rakam **ve** etiket (Düşük/Orta/Yüksek) |
| Önce/sonra | Eklenen metin yeşil vurgu, çıkarılan üstü çizili gri |

Skorun yalnızca renkle değil etiketle de gösterilmesi renk körlüğü
gereğidir (rehber §9.2) — testte atlanmamalı.

**Dosyalar:**
- Değiştir: `apps/web/app/globals.css`
- Değiştir: `apps/web/app/layout.tsx` (font bağlantısı)
- Oluştur: `apps/web/app/adapt/[id]/page.tsx`
- Oluştur: `apps/web/app/adapt/[id]/diff.ts`
- Test: `apps/web/app/adapt/[id]/diff.test.ts`
- Değiştir: `apps/web/app/test/page.tsx` (uyarlama başlatma butonu)

**Arayüzler:**
- Tüketir: Görev 12'nin dört route'u.
- Üretir: `diffWords(original: string, rewritten: string): DiffPart[]`,
  `DiffPart { text: string; kind: "same" | "added" | "removed" }`

- [ ] **Adım 1: Fark testini yaz**

`apps/web/app/adapt/[id]/diff.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { diffWords } from "./diff"

describe("diffWords", () => {
  it("aynı metinde her şey same olur", () => {
    expect(diffWords("React ile panel", "React ile panel")).toEqual([
      { text: "React ile panel", kind: "same" },
    ])
  })

  it("eklenen kelimeyi added işaretler", () => {
    const parcalar = diffWords("React ile panel", "React ile müşteri panel")
    expect(parcalar.filter((p) => p.kind === "added").map((p) => p.text)).toEqual(["müşteri"])
  })

  it("çıkarılan kelimeyi removed işaretler", () => {
    const parcalar = diffWords("React ile eski panel", "React ile panel")
    expect(parcalar.filter((p) => p.kind === "removed").map((p) => p.text)).toEqual(["eski"])
  })

  it("değiştirilen kelimeyi hem removed hem added verir", () => {
    const parcalar = diffWords("panel yaptım", "panel geliştirdim")
    expect(parcalar.filter((p) => p.kind === "removed").map((p) => p.text)).toEqual(["yaptım"])
    expect(parcalar.filter((p) => p.kind === "added").map((p) => p.text)).toEqual([
      "geliştirdim",
    ])
  })

  it("noktalama kelimeye yapışık kalır", () => {
    // "panel." ile "panel" ayrı kelime sayılırsa her cümle sonu fark görünür.
    const parcalar = diffWords("Panel yaptım.", "Panel yaptım.")
    expect(parcalar.every((p) => p.kind === "same")).toBe(true)
  })

  it("boş orijinalde her şey added olur", () => {
    expect(diffWords("", "yeni metin").every((p) => p.kind === "added")).toBe(true)
  })

  it("kelime sırasını korur", () => {
    const parcalar = diffWords("a b c", "a x c")
    expect(parcalar.map((p) => p.text).join(" ")).toContain("a")
    expect(parcalar[parcalar.length - 1]!.text).toBe("c")
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/web test adapt`
Beklenen: FAIL — `Cannot find module './diff'`

- [ ] **Adım 3: Farkı uygula**

`apps/web/app/adapt/[id]/diff.ts`:

```ts
export interface DiffPart {
  text: string
  kind: "same" | "added" | "removed"
}

/**
 * Kelime düzeyinde fark (marka rehberi §9.5): eklenen yeşil vurgu, çıkarılan
 * üstü çizili gri.
 *
 * Kütüphane eklenmiyor: LCS'nin kelime düzeyi uygulaması otuz satır ve
 * maddeler kısa. Karakter düzeyinde fark Türkçe eklerde okunaksız çıkıyor —
 * "geliştirdim"i "yaptım"a bağlarken ortak harfleri işaretlemek gürültü.
 */
export function diffWords(original: string, rewritten: string): DiffPart[] {
  const a = original.split(/\s+/).filter(Boolean)
  const b = rewritten.split(/\s+/).filter(Boolean)

  // En uzun ortak alt dizi tablosu.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  )
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }

  const parcalar: DiffPart[] = []
  const ekle = (text: string, kind: DiffPart["kind"]) => {
    const son = parcalar[parcalar.length - 1]
    // Bitişik aynı türden parçalar birleşiyor; aksi hâlde her kelime ayrı
    // bir span olur ve vurgu parçalı görünür.
    if (son?.kind === kind) son.text += ` ${text}`
    else parcalar.push({ text, kind })
  }

  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ekle(a[i]!, "same")
      i++
      j++
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      ekle(a[i]!, "removed")
      i++
    } else {
      ekle(b[j]!, "added")
      j++
    }
  }
  while (i < a.length) ekle(a[i++]!, "removed")
  while (j < b.length) ekle(b[j++]!, "added")

  return parcalar
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/web test adapt`
Beklenen: PASS — 7 test geçti.

- [ ] **Adım 5: Marka değişkenlerini yaz**

`apps/web/app/globals.css` dosyasının **başına** ekle (mevcut Sprint 1
kuralları altında kalsın; çakışanları sonraki adımda temizleyeceğiz):

```css
/* Marka rehberi §9.2 ve §9.5. Renkler yalnızca burada tanımlı; bileşenler
   değişkenden okur ki tema değişimi tek yerden yapılabilsin. */
:root {
  --mavi: #2b4eff;
  --gece: #0f172a;
  --buz: #f5f7ff;
  --mercan: #ff6b4a;
  --yesil: #16a34a;
  --kehribar: #f59e0b;
  --kirmizi: #dc2626;
  --gri: #64748b;

  --zemin: var(--buz);
  --metin: var(--gece);
  --kart: #ffffff;
  --cizgi: #e2e8f0;

  --yaricap-buton: 10px;
  --yaricap-kart: 16px;
}

@media (prefers-color-scheme: dark) {
  /* Koyu temada zemin Gece rengidir (rehber §9.5). */
  :root {
    --zemin: var(--gece);
    --metin: #f8fafc;
    --kart: #1e293b;
    --cizgi: #334155;
  }
}

body {
  background: var(--zemin);
  color: var(--metin);
  font-family: Inter, system-ui, -apple-system, sans-serif;
}

h1, h2, h3 {
  font-family: Manrope, Inter, system-ui, sans-serif;
  font-weight: 800;
}

.kart {
  background: var(--kart);
  border: 1px solid var(--cizgi);
  border-radius: var(--yaricap-kart);
  padding: 1rem 1.25rem;
  margin-bottom: 0.75rem;
}

/* Birincil eylem her ekranda TEK ve Uyarla Mavisi (rehber §9.5). */
.btn-birincil {
  background: var(--mavi);
  color: #fff;
  border: none;
  border-radius: var(--yaricap-buton);
  padding: 0.7rem 1.4rem;
  font-weight: 600;
}
.btn-ikincil {
  background: transparent;
  color: var(--metin);
  border: 1px solid var(--cizgi);
  border-radius: var(--yaricap-buton);
  padding: 0.7rem 1.4rem;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }

/* Önce/sonra (rehber §9.5). */
.eklenen { background: rgba(22, 163, 74, 0.18); border-radius: 3px; }
.cikarilan { text-decoration: line-through; color: var(--gri); }

/* Skor ekranın en büyük öğesi (rehber §9.5). */
.skor-blok { display: flex; align-items: baseline; gap: 0.75rem; }
.skor-rakam { font-family: Manrope, sans-serif; font-size: 4rem; font-weight: 800; line-height: 1; }
.skor-etiket { font-size: 0.9rem; font-weight: 600; }
.skor-ok { color: var(--gri); font-size: 2rem; }

.rozet {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(245, 158, 11, 0.18);
  color: var(--kehribar);
}
.gerekce { color: var(--kehribar); font-size: 0.85rem; margin: 0.35rem 0 0; }
```

`apps/web/app/layout.tsx` içindeki `<html>`'e font bağlantısı ekle:

```tsx
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
```

`metadata`'yı da güncelle: `{ title: "uyarla" }`.

- [ ] **Adım 6: Uyarlama ekranını yaz**

`apps/web/app/adapt/[id]/page.tsx`:

```tsx
"use client"

import { use, useCallback, useEffect, useState } from "react"
import { diffWords } from "./diff"

const STAGE_TEXT: Record<string, string> = {
  yeniden_yaziliyor: "CV'ni ilana göre yeniden yazıyoruz…",
  kontrol_ediliyor: "Hiçbir şey uydurulmadığını kontrol ediyoruz…",
}

interface Verification {
  status: "ok" | "flagged"
  issues: Array<{ kind: string; detail: string }>
}

interface Bullet {
  id: string
  original: string
  rewritten: string
  verification: Verification
  decision: "accepted" | "rejected" | "pending"
}

interface Draft {
  summary: { original: string | null; rewritten: string; verification: Verification; decision: string }
  bullets: Bullet[]
  skillOrder: string[]
}

interface Durum {
  status: "running" | "draft" | "ready" | "failed"
  draft: Draft | null
  scoreBefore: number | null
  scoreAfter: number | null
}

/** Skor yalnızca renkle değil etiketle de anlatılıyor (rehber §9.2). */
function skorEtiketi(skor: number): { metin: string; renk: string } {
  if (skor >= 70) return { metin: "Yüksek uyum", renk: "var(--yesil)" }
  if (skor >= 40) return { metin: "Orta uyum", renk: "var(--kehribar)" }
  return { metin: "Düşük uyum", renk: "var(--kirmizi)" }
}

function Fark({ original, rewritten }: { original: string; rewritten: string }) {
  return (
    <p>
      {diffWords(original, rewritten).map((parca, i) =>
        parca.kind === "same" ? (
          <span key={i}>{parca.text} </span>
        ) : (
          <span key={i} className={parca.kind === "added" ? "eklenen" : "cikarilan"}>
            {parca.text}{" "}
          </span>
        ),
      )}
    </p>
  )
}

export default function AdaptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [durum, setDurum] = useState<Durum | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  const yokla = useCallback(async (): Promise<Durum | null> => {
    const cevap = await fetch(`/api/adapt/${id}`)
    if (!cevap.ok) return null
    const yeni = (await cevap.json()) as Durum
    setDurum(yeni)
    return yeni
  }, [id])

  // Çalışırken yokluyor, bitince duruyor. Zamanlayıcı setDurum içinden
  // değil bu döngüden yönetiliyor: durum güncelleyicisinin yan etkisi
  // olması React'in çift çağırmasıyla iki döngü başlatırdı.
  useEffect(() => {
    let durduruldu = false
    ;(async () => {
      while (!durduruldu) {
        const son = await yokla()
        if (!son || son.status !== "running") return
        await new Promise((r) => setTimeout(r, 1500))
      }
    })()
    return () => {
      durduruldu = true
    }
  }, [yokla])

  async function karar(itemId: string, decision: "accepted" | "rejected") {
    const cevap = await fetch(`/api/adapt/${id}/decision`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId, decision }),
    })
    if (!cevap.ok) return
    const govde = (await cevap.json()) as Partial<Durum>
    setDurum((d) => (d ? { ...d, ...govde } : d))
  }

  async function indir(format: "pdf" | "docx") {
    setHata(null)
    const cevap = await fetch(`/api/adapt/${id}/download?format=${format}`)
    if (!cevap.ok) {
      setHata((await cevap.json()).error)
      return
    }
    const blob = await cevap.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `uyarla-cv.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!durum) return <p>Yükleniyor…</p>
  if (durum.status === "running") return <p>{STAGE_TEXT.yeniden_yaziliyor}</p>
  if (durum.status === "failed" || !durum.draft) {
    return <p>Uyarlama tamamlanamadı. Birazdan tekrar dener misin?</p>
  }

  const bekleyen = durum.draft.bullets.filter((b) => b.decision === "pending").length
  const sonra = durum.scoreAfter ?? 0
  const etiket = skorEtiketi(sonra)

  return (
    <main>
      <h1>CV'n hazır</h1>

      <div className="skor-blok">
        <span className="skor-rakam" style={{ color: "var(--gri)" }}>
          {durum.scoreBefore ?? 0}
        </span>
        <span className="skor-ok">→</span>
        <span className="skor-rakam" style={{ color: etiket.renk }}>
          {sonra}
        </span>
        <span className="skor-etiket" style={{ color: etiket.renk }}>
          {etiket.metin}
        </span>
      </div>

      {durum.draft.summary.original && (
        <section className="kart">
          <h3>Özet</h3>
          <Fark
            original={durum.draft.summary.original}
            rewritten={durum.draft.summary.rewritten}
          />
          <button className="btn-ikincil" onClick={() => karar("summary", "rejected")}>
            Eski hâlini kullan
          </button>
        </section>
      )}

      <h2>Deneyim maddeleri</h2>
      {durum.draft.bullets.map((madde) => (
        <section className="kart" key={madde.id}>
          {madde.verification.status === "flagged" && (
            <>
              <span className="rozet">Kontrol et</span>
              {madde.verification.issues.map((sorun, i) => (
                <p className="gerekce" key={i}>
                  {sorun.detail}
                </p>
              ))}
            </>
          )}
          <Fark original={madde.original} rewritten={madde.rewritten} />
          <button
            className="btn-ikincil"
            disabled={madde.decision === "accepted"}
            onClick={() => karar(madde.id, "accepted")}
          >
            {madde.decision === "accepted" ? "Kullanılıyor" : "Yeni hâlini kullan"}
          </button>{" "}
          <button
            className="btn-ikincil"
            disabled={madde.decision === "rejected"}
            onClick={() => karar(madde.id, "rejected")}
          >
            {madde.decision === "rejected" ? "Eski hâli kullanılıyor" : "Eski hâlini kullan"}
          </button>
        </section>
      ))}

      <h2>Beceriler</h2>
      <p className="kart">{durum.draft.skillOrder.join(" · ")}</p>

      {bekleyen > 0 && (
        <p className="gerekce">
          {bekleyen} madde için karar bekliyoruz. Karar verince indirme açılır.
        </p>
      )}
      {hata && <p className="gerekce">{hata}</p>}

      <p>
        <button className="btn-birincil" disabled={bekleyen > 0} onClick={() => indir("pdf")}>
          PDF indir
        </button>{" "}
        <button className="btn-ikincil" disabled={bekleyen > 0} onClick={() => indir("docx")}>
          Word indir
        </button>
      </p>

      <p className="gerekce" style={{ color: "var(--gri)" }}>
        Metinler yapay zekâ ile yeniden yazıldı. Hiçbir deneyim, beceri veya
        sertifika eklenmedi.
      </p>
    </main>
  )
}
```

Son paragraf marka rehberi §11'in "yapay zekâ şeffaflığı" ve "uydurmama
ilkesi" maddelerinin karşılığı; kaldırılmamalı.

- [ ] **Adım 7: Analiz ekranına uyarlama butonu ekle**

`apps/web/app/test/page.tsx` içinde, analiz tamamlandığında gösterilen
bloğa ekle:

```tsx
        <button
          className="btn-birincil"
          onClick={async () => {
            const cevap = await fetch("/api/adapt", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ analysisId: state.analysisId }),
            })
            const govde = await cevap.json()
            if (cevap.ok) window.location.href = `/adapt/${govde.adaptationId}`
          }}
        >
          CV'mi bu ilana uyarla
        </button>
```

`analysisId`'nin arayüze ulaşması gerekiyor —
`apps/web/app/api/analyze/[id]/route.ts` içindeki `completed` cevabına ekle:

```ts
      analysisId,
```

ve `AnalysisResponse` arayüzüne `analysisId?: string` alanını ekle.

- [ ] **Adım 8: Elle gözden geçir**

Tarayıcıda bir analiz çalıştır, uyarlamaya geç ve kontrol et:

- Skor ekranın en büyük öğesi mi, yanında etiket var mı?
- Birincil eylem (PDF indir) ekranda tek mavi buton mu?
- Eklenen metin yeşil, çıkarılan üstü çizili gri mi?
- Uyarı taşıyan madde rozetli ve gerekçeli mi?
- Bekleyen karar varken indirme butonları kapalı mı?
- Koyu temada (sistem ayarından) zemin Gece rengi mi, kontrast okunur mu?

- [ ] **Adım 9: Testleri çalıştır ve commit**

```bash
pnpm --filter @uyarla/web test
pnpm --filter @uyarla/web typecheck
pnpm --filter @uyarla/web build
git add apps/web
git commit -m "feat: marka giydirmesi ve uyarlama ekranı"
```

---

### Görev 14: Değerlendirme setinin genişletilmesi

Spec §12. Sprint 2'nin ana vaadinin taban çizgisi. Sprint 1'in dersi buydu:
**ölçülmeyen kalite, olmayan kalitedir.**

**Dosyalar:**
- Oluştur: `packages/core/eval/uyarla.ts`
- Değiştir: `packages/core/eval/types.ts`
- Değiştir: `packages/core/package.json` (`eval:adapt` betiği)
- Değiştir: `docs/kararlar.md`

**Arayüzler:**
- Tüketir: Görev 5, 6, 7'nin tümü; `eval/cache` altındaki Sprint 1
  önbelleği.
- Üretir: `pnpm eval:adapt` komutu ve `eval/runs/uyarla-<zaman>.json`

- [ ] **Adım 1: Ölçüm tiplerini ekle**

`packages/core/eval/types.ts` sonuna ekle:

```ts
/** Bir çiftin uyarlama ölçümü (spec §12). */
export interface AdaptMetrics {
  id: string
  bulletCount: number
  /** Doğrulamadan uyarıyla dönen madde sayısı. */
  flaggedCount: number
  /** Hangi kontrolün kaç kez devreye girdiği. */
  byKind: Record<string, number>
  scoreBefore: number
  /** Tüm yeniden yazımlar kabul edilmiş varsayımıyla. */
  scoreAfter: number
  durationMs: number
  /** Yeniden yazımı patlayan madde sayısı (spec §13). */
  failedCount: number
}
```

- [ ] **Adım 2: Değerlendirme betiğini yaz**

`packages/core/eval/uyarla.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { bulletId } from "../src/adapt/profile.js"
import { rescore } from "../src/adapt/rescore.js"
import { rewriteBullets } from "../src/adapt/rewrite.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import { llmConfigFromEnv } from "../src/llm/types.js"
import type { AdaptationDraft } from "../src/schemas/adaptation.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { collectEvidence } from "../src/score/evidence.js"
import { conceptTexts, score } from "../src/score/score.js"
import { verifyRewrite } from "../src/verify/verify.js"
import type { AdaptMetrics, EvalPair } from "./types.js"

/**
 * Uyarlama değerlendirme koşusu (spec §12).
 *
 * Ölçtüğü üç şey:
 *   1. İşaretlenen madde oranı — uydurma kontrolü ne sıklıkla devreye giriyor
 *   2. Kontrol türü dağılımı — hangi kontrol ne yakalıyor
 *   3. Skor değişimi — uyarlama gerçekten eşleşme kazandırıyor mu
 *
 * Çıkarım `eval:prepare` önbelleğinden geliyor; bu betik yalnızca yeniden
 * yazma ve doğrulama yapıyor.
 */
const KOK = import.meta.dirname
const CACHE = join(KOK, "cache")
const PAIRS = join(KOK, "pairs")
const RUNS = join(KOK, "runs")

async function main() {
  const llmConfig = llmConfigFromEnv()
  const llm = new LmStudioProvider(llmConfig)
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())

  const dosyalar = readdirSync(PAIRS).filter((f) => f.endsWith(".json")).sort()
  console.log(`[eval:adapt] ${dosyalar.length} çift · model: ${llmConfig.model}\n`)

  const metrics: AdaptMetrics[] = []

  for (const dosya of dosyalar) {
    const pair = JSON.parse(readFileSync(join(PAIRS, dosya), "utf8")) as EvalPair
    const basladi = Date.now()

    const profil = JSON.parse(
      readFileSync(join(CACHE, `cv-${pair.cv}.json`), "utf8"),
    ) as ResumeProfile
    const ilan = JSON.parse(
      readFileSync(join(CACHE, `ilan-${pair.ilan}.json`), "utf8"),
    ) as JobPostingData

    const maddeler = profil.experience.flatMap((job, i) =>
      job.bullets.map((b, j) => ({
        id: bulletId(i, j),
        experienceIndex: i,
        original: b.text,
        sourceRef: b.sourceRef,
      })),
    )

    const yazimlar = await rewriteBullets(llm, maddeler.map((m) => m.original), ilan)
    const yeniMetinler = maddeler.map((m, i) => yazimlar[i]?.data ?? m.original)
    const vektorler = await embedding.embed([
      ...yeniMetinler,
      ...maddeler.map((m) => m.sourceRef),
    ])

    const byKind: Record<string, number> = {}
    let flaggedCount = 0

    const bullets = maddeler.map((madde, i) => {
      const dogrulama =
        yazimlar[i] === null
          ? { status: "ok" as const, issues: [] }
          : verifyRewrite({
              rewritten: yeniMetinler[i]!,
              source: madde.sourceRef,
              posting: ilan,
              vectors: {
                rewritten: vektorler[i]!,
                source: vektorler[maddeler.length + i]!,
              },
            })

      if (dogrulama.status === "flagged") flaggedCount++
      for (const sorun of dogrulama.issues) {
        byKind[sorun.kind] = (byKind[sorun.kind] ?? 0) + 1
      }

      return {
        ...madde,
        rewritten: yeniMetinler[i]!,
        verification: dogrulama,
        // Ölçüm için hepsi kabul: uyarlamanın ÜST SINIR kazancını görüyoruz.
        // Gerçek kullanımda kullanıcı bazılarını reddedecek.
        decision: "accepted" as const,
      }
    })

    const taslak: AdaptationDraft = {
      summary: {
        original: profil.summary,
        rewritten: profil.summary ?? "",
        verification: { status: "ok", issues: [] },
        decision: "rejected",
      },
      bullets,
      skillOrder: profil.skills,
    }

    const kanitlar = collectEvidence(profil)
    const kanitMetinleri = kanitlar.map((k) => k.text)
    const kavramMetinleri = conceptTexts(ilan)
    const oncekiVektorler = await embedding.embed([...kanitMetinleri, ...kavramMetinleri])
    const onceki = score({
      profile: profil,
      posting: ilan,
      evidence: kanitlar,
      evidenceVectors: oncekiVektorler.slice(0, kanitMetinleri.length),
      conceptVectors: oncekiVektorler.slice(kanitMetinleri.length),
    }).score

    const sonraki = await rescore({ profile: profil, posting: ilan, draft: taslak }, embedding)

    const m: AdaptMetrics = {
      id: pair.id,
      bulletCount: maddeler.length,
      flaggedCount,
      byKind,
      scoreBefore: onceki,
      scoreAfter: sonraki,
      durationMs: Date.now() - basladi,
      failedCount: yazimlar.filter((y) => y === null).length,
    }
    metrics.push(m)

    console.log(
      `  ${pair.id.padEnd(30)} ${m.bulletCount} madde · ` +
        `işaretli ${m.flaggedCount} · skor ${m.scoreBefore}→${m.scoreAfter} · ` +
        `${Math.round(m.durationMs / 1000)}s` +
        (m.failedCount ? ` · patlayan ${m.failedCount}` : ""),
    )
  }

  const toplamMadde = metrics.reduce((t, m) => t + m.bulletCount, 0)
  const toplamIsaretli = metrics.reduce((t, m) => t + m.flaggedCount, 0)
  const turler: Record<string, number> = {}
  for (const m of metrics) {
    for (const [k, v] of Object.entries(m.byKind)) turler[k] = (turler[k] ?? 0) + v
  }
  const ortalamaDegisim =
    metrics.reduce((t, m) => t + (m.scoreAfter - m.scoreBefore), 0) / metrics.length

  console.log(`\n  toplam madde        : ${toplamMadde}`)
  console.log(
    `  işaretlenen oranı   : %${((toplamIsaretli / toplamMadde) * 100).toFixed(1)} ` +
      `(${toplamIsaretli}/${toplamMadde})`,
  )
  console.log(`  kontrol dağılımı    : ${JSON.stringify(turler)}`)
  console.log(`  ortalama skor değişimi: ${ortalamaDegisim >= 0 ? "+" : ""}${ortalamaDegisim.toFixed(1)}`)

  if (!existsSync(RUNS)) mkdirSync(RUNS, { recursive: true })
  const dosya = join(RUNS, `uyarla-${new Date().toISOString().replace(/[:.]/g, "-")}.json`)
  writeFileSync(
    dosya,
    JSON.stringify({ model: llmConfig.model, metrics, turler, ortalamaDegisim }, null, 2),
  )
  console.log(`\n  → ${dosya}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

`packages/core/package.json` betiklerine ekle:

```json
    "eval:adapt": "dotenv -e ../../.env -- tsx eval/uyarla.ts"
```

- [ ] **Adım 3: Ölçümü çalıştır**

LM Studio ve Ollama açıkken:

```bash
pnpm --filter @uyarla/core eval:adapt
```

Bu uzun sürüyor (madde başına bir çağrı × 10 çift). Arka planda çalıştır ve
çıktıyı bir dosyaya yaz.

- [ ] **Adım 4: Eşiği ayarla**

Çıktıdaki `semantic_drift` sayısına bak:

- `semantic_drift` diğer iki kontrolü ezip geçiyorsa (örneğin işaretli
  maddelerin %80'i yalnız sapma), eşik fazla hassas. `0.70` ve `0.65` ile
  tekrar çalıştır.
- Hiç tetiklenmiyorsa `0.80` dene.

Her denemeyi `DEFAULT_VERIFICATION_CONFIG.driftThreshold` değerini
değiştirip `eval:adapt`'ı tekrar çalıştırarak yap ve sayıları not et.
Sprint 1'deki eşik taraması (K-24) ile aynı yöntem: **karar ölçümle
verilir, sezgiyle değil.**

- [ ] **Adım 5: Sonucu karar olarak yaz**

`docs/kararlar.md`'ye **K-30** ekle. İçeriği ölçümden gelecek; iskelet:

```markdown
### K-30 · Anlamsal sapma eşiği

**Karar:** `driftThreshold = <ölçülen değer>`

**Ölçüm:** 10 çift, <N> madde. Eşik taraması:

| Eşik | İşaretlenen oran | Sapma / sayı / enjeksiyon |
|---|---|---|
| 0.65 | … | … |
| 0.70 | … | … |
| 0.75 | … | … |
| 0.80 | … | … |

**Gerekçe:** …

**Ortalama skor değişimi:** … — Sprint 2'nin ana vaadinin taban çizgisi.

**Reddedilenler:** …
```

Ayrıca ortalama skor değişimi **sıfıra yakın ya da negatifse** bu spec
§15'teki ikinci risktir: prompt ilana özel kavramları daha doğrudan
hedeflemeli. `BULLET_PROMPT`'u güncelle ve ölçümü tekrarla; hangi
prompt'un ne kazandırdığını K-30'a yaz.

- [ ] **Adım 6: Commit**

```bash
git add packages/core docs/kararlar.md
git commit -m "test: uyarlama değerlendirme koşusu ve eşik ayarı"
```

---

### Görev 15: Kullanılabilirlik testi ve K2 kararı

Spec §14. Karar kapısı: **5 test kullanıcısından en az 4'ü uyarlanmış CV'yi
gerçek bir başvuruda kullanmak istiyor.**

**Dosyalar:**
- Oluştur: `docs/kullanilabilirlik-testi.md`
- Değiştir: `docs/kararlar.md`

- [ ] **Adım 1: Test betiğini yaz**

`docs/kullanilabilirlik-testi.md`:

```markdown
# Sprint 2 Kullanılabilirlik Testi

## Kurulum

Katılımcı kendi CV'sini ve gerçekten ilgilendiği bir ilanı getiriyor.
Yönlendirme yok: ekranı paylaş, "sesli düşün" de, sonra sus.

## Görevler

1. CV'ni yükle ve ilanı yapıştır.
2. Skoru gör ve ne anladığını anlat.
3. CV'ni bu ilana uyarla.
4. Değişiklikleri incele ve karar ver.
5. Belgeyi indir.

## Her katılımcı için not

| Soru | Not |
|---|---|
| Hangi adımda duraksadı? | |
| İşaretli maddede ne yaptı, gerekçeyi anladı mı? | |
| Önce/sonra farkını fark etti mi? | |
| Skorun neden değiştiğini/değişmediğini anladı mı? | |
| **Bu CV'yi gerçek bir başvuruda kullanır mıydın?** (E/H) | |
| Kullanmazsa neden? | |

## K2 ölçütü

5 kişiden en az 4'ü son soruya "evet" derse K2 geçildi.
Geçilmezse: uyarlama kalitesine odaklanılır, ödeme işi bir hafta ertelenir.
```

- [ ] **Adım 2: Beş kişiyle testi yap**

Her oturum ~20 dakika. Notları yukarıdaki tabloya doldur ve dosyaya ekle.

- [ ] **Adım 3: K2 kararını yaz**

`docs/kararlar.md`'ye **K-31** ekle: kaç kişi "evet" dedi, hangi adımda
takıldılar, K2 geçildi mi, geçilmediyse ne ertelendi. Karar ölçümle
gerekçelendirilecek — beş kişilik bir örneklem küçük ama gözlemler somut.

- [ ] **Adım 4: Tamamlanma tanımını doğrula**

Spec §14'teki listeyi tek tek geç:

```
[ ] Kullanıcı bir analiz sonucundan uyarlama başlatabiliyor
[ ] Özet, maddeler ve beceri sıralaması üretiliyor
[ ] Üç uydurma kontrolü çalışıyor ve gerekçe üretiyor
[ ] Uyarı taşıyan maddeler karara bağlanmadan indirme açılmıyor
[ ] PDF ve DOCX indiriliyor; PDF'in metni seçilebilir
[ ] Uyarlama sonrası skor gösteriliyor
[ ] Arayüz marka rehberine uygun
[ ] Değerlendirme setinde işaretlenen madde oranı ölçülmüş ve kaydedilmiş
[ ] 5 kullanıcıyla test yapılmış, K2 kararı docs/kararlar.md'ye yazılmış
```

Ayrıca spec §15'teki son risk: **çıktı en az bir gerçek ATS tarayıcısına
sokulmalı.** Ücretsiz bir ATS uyumluluk aracına `/tmp/uyarla.pdf` yüklenip
sonucu K-31'e yazılır.

- [ ] **Adım 5: Marka rehberini güncelle**

Marka rehberi §11 "kullanıcı her değişikliği onaylar" diyor; K-26 bunu
risk tabanlı onaya çevirdi. `docs/Uyarla_Marka_Rehberi.docx` §11'deki
"yapay zekâ şeffaflığı" maddesini güncelle:

> Metinlerin yapay zekâ ile yeniden yazıldığı açıkça belirtilir. Uydurma
> riski taşıyan her değişiklik kullanıcıya gerekçesiyle gösterilir ve
> kullanıcı onayı olmadan çıktıya girmez.

- [ ] **Adım 6: Commit**

```bash
git add docs/
git commit -m "docs: kullanılabilirlik testi notları ve K2 kararı"
```

---

## Sprint Sonu

Tüm görevler bittiğinde:

```bash
pnpm -r test
pnpm -r typecheck
pnpm --filter @uyarla/web build
```

Sonra `superpowers:finishing-a-development-branch` ile dalı kapat.

Açık kalan işler `docs/birikmis-isler.md`'ye yazılır — Sprint 1'de olduğu
gibi, "sonra bakarız" denilen hiçbir şey kafada kalmaz.
