# Sprint 1 — Temel ve Çekirdek AI · Implementasyon Planı

> **Ajan çalışanlar için:** GEREKLİ ALT-SKILL: Bu planı görev görev uygulamak için
> `superpowers:subagent-driven-development` (önerilen) veya
> `superpowers:executing-plans` kullanın. Adımlar takip için checkbox (`- [ ]`)
> sözdizimi kullanır.

**Hedef:** Bir CV ve bir ilan metni verildiğinde, 30 saniyenin altında
açıklanabilir bir ATS uyum skoru ve gereksinim bazlı eksik listesi üretmek.

**Mimari:** pnpm monorepo. `packages/core` framework'süz alan mantığını barındırır
(şemalar, çıkarım, Türkçe normalleştirme, skor); `apps/web` ince bir Next.js HTTP
katmanı ve markasız test arayüzü; `apps/worker` ağır işi yapan BullMQ işçisi.
LLM ve embedding çağrıları yerel LM Studio'ya, tek bir sağlayıcı soyutlamasının
arkasından gider.

**Teknoloji:** TypeScript, Next.js (App Router), Prisma + PostgreSQL, BullMQ +
Redis, Vitest, Zod, `openai` paketi (LM Studio'nun OpenAI uyumlu endpoint'i için),
Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-22-sprint-1-cekirdek-ai-design.md`

## Genel Kısıtlar

Bu bölüm her görevin gereksinimlerine örtük olarak dahildir.

- **Node 22+, pnpm 9+.** Paket yöneticisi `pnpm`; `npm` veya `yarn` komutu kullanılmaz.
- **TypeScript `strict: true`.** `any` kullanılmaz; kaçınılmazsa `unknown` + daraltma.
- **Test koşucusu Vitest.** Her paket kendi `vitest.config.ts` dosyasını taşır.
- **`packages/core` hiçbir framework'e bağlanmaz.** İçinde `next`, `bullmq`,
  `@prisma/client` importu bulunamaz. Girdi alır, çıktı verir.
- **Model adı kodda geçmez.** `google/gemma-4-e4b` yalnızca `.env` dosyasında
  bulunur; kod `process.env.LLM_MODEL` okur (K-03).
- **LM Studio uçları:** `LLM_BASE_URL=http://localhost:1234/v1`,
  `LLM_MODEL=google/gemma-4-e4b`, `EMBEDDING_MODEL=bge-m3`.
- **Skor sabitleri:** `must` ağırlığı `2.0`, `nice` ağırlığı `1.0`, anlamsal
  eşleşme eşiği `0.65`. Üçü de tek bir `ScoringConfig` nesnesinde toplanır.
- **Kullanıcıya görünen tüm metinler Türkçe** ve marka rehberi §6 tonundadır:
  "sen" diliyle, kısa cümle, önce sonuç. Hata mesajları suçlamaz, sonraki adımı
  gösterir.
- **Uydurma eşleşme, kaçırmadan zararlıdır.** Kararsız kalınan her yerde
  `missing` tarafına yanılınır.
- **Her görev testle biter ve commit'lenir.** Testler geçmeden commit atılmaz.
- **Commit mesajları Türkçe**, `feat:` / `test:` / `chore:` öneki ile.

---

## Dosya Yapısı

Görevler başlamadan önce hangi dosyanın neden sorumlu olduğu:

### `packages/core` — alan mantığı, framework'süz

| Dosya | Sorumluluk |
|---|---|
| `src/llm/types.ts` | `LlmProvider`, `EmbeddingProvider` arayüzleri ve ortak tipler |
| `src/llm/lmstudio.ts` | LM Studio uygulaması (`openai` paketi, `json_schema` kısıtı) |
| `src/schemas/resume.ts` | CV profili Zod şeması + JSON Schema dönüşümü |
| `src/schemas/job.ts` | İlan ve gereksinim Zod şeması + JSON Schema dönüşümü |
| `src/documents/extractText.ts` | PDF/DOCX → ham metin; taranmış PDF tespiti |
| `src/storage/fileStore.ts` | `FileStore` sözleşmesi + `LocalFileStore` |
| `src/normalize/turkish.ts` | Türkçe normalleştirme: küçültme, ek soyma, unvan sözlüğü |
| `src/normalize/titles.ts` | Unvan eş anlamlı sözlüğü (veri) |
| `src/extract/resume.ts` | İki aşamalı CV çıkarımı |
| `src/extract/job.ts` | İlan çıkarımı |
| `src/score/config.ts` | `ScoringConfig` — ağırlıklar ve eşik |
| `src/score/score.ts` | Saf skor fonksiyonu, üç aşamalı kanıt arama |
| `src/errors.ts` | Hata sınıfları: kalıcı / geçici / beklenmeyen ayrımı |
| `src/index.ts` | Paketin dışa açtığı yüzey |
| `eval/pairs/*.json` | 10 CV–ilan çifti ve beklentileri |
| `eval/run.ts` | Ölçüm betiği |

### `packages/db` — kalıcılık

| Dosya | Sorumluluk |
|---|---|
| `prisma/schema.prisma` | Veri modeli |
| `src/index.ts` | Tekil Prisma client |

### `apps/worker` — ağır iş

| Dosya | Sorumluluk |
|---|---|
| `src/queue.ts` | Kuyruk tanımı ve iş tipleri |
| `src/pipeline.ts` | `analyze` işinin aşama sırası |
| `src/index.ts` | İşçi süreci giriş noktası |

### `apps/web` — HTTP katmanı ve test arayüzü

| Dosya | Sorumluluk |
|---|---|
| `app/api/analyze/route.ts` | İş oluşturma |
| `app/api/analyze/[id]/route.ts` | Durum ve sonuç sorgulama |
| `app/test/page.tsx` | Markasız test arayüzü |
| `lib/queue.ts` | Kuyruğa üretici tarafı bağlantı |

---

## Görev Sırası

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13
```

| # | Görev | Spec bölümü |
|---|---|---|
| 1 | Monorepo iskeleti ve geliştirme ortamı | §4.1 |
| 2 | Veri modeli ve migration | §5 |
| 3 | Belge metin çıkarma ve dosya depolama | §2, §11 |
| 4 | LLM sağlayıcı soyutlaması | §6.1 |
| 5 | Çıkarım şemaları | §6.2 |
| 6 | CV çıkarımı (iki aşamalı) | §6.3 |
| 7 | İlan çıkarımı | §6.2 |
| 8 | Türkçe normalleştirme | §7 |
| 9 | Embedding sağlayıcı | §6.1, §7 |
| 10 | Skor servisi | §7 |
| 11 | Kuyruk ve işçi süreci | §8 |
| 12 | API route'ları ve test arayüzü | §9 |
| 13 | Değerlendirme seti ve ölçüm betiği | §10 |

---

### Görev 1: Monorepo iskeleti ve geliştirme ortamı

Spec §4.1. Bu görev bittiğinde `pnpm test` çalışıyor, `docker compose up -d`
Postgres ve Redis'i ayağa kaldırıyor olmalı.

**Dosyalar:**
- Oluştur: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`, `docker-compose.yml`
- Oluştur: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`
- Oluştur: `packages/core/src/index.ts`
- Test: `packages/core/src/index.test.ts`

**Arayüzler:**
- Üretir: `@uyarla/core` paket adı; sonraki tüm görevler bu addan import eder.

- [ ] **Adım 1: Kök workspace dosyalarını oluştur**

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`package.json`:

```json
{
  "name": "uyarla",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.7.0"
  }
}
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Adım 2: Docker Compose ve örnek ortam dosyasını oluştur**

`docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: uyarla
      POSTGRES_PASSWORD: uyarla
      POSTGRES_DB: uyarla
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U uyarla"]
      interval: 5s
      retries: 10
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
volumes:
  pgdata:
```

`.env.example`:

```bash
DATABASE_URL="postgresql://uyarla:uyarla@localhost:5432/uyarla"
REDIS_URL="redis://localhost:6379"

# LM Studio — OpenAI uyumlu yerel endpoint (K-03)
LLM_BASE_URL="http://localhost:1234/v1"
LLM_MODEL="google/gemma-4-e4b"
LLM_TIMEOUT_MS="60000"
EMBEDDING_MODEL="bge-m3"

STORAGE_DIR="./storage"
```

- [ ] **Adım 3: `packages/core` paketini oluştur**

`packages/core/package.json`:

```json
{
  "name": "@uyarla/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "typescript": "^5.6.0"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "eval"]
}
```

`packages/core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
  },
})
```

- [ ] **Adım 4: Kurulumun çalıştığını doğrulayan testi yaz**

`packages/core/src/index.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { PACKAGE_NAME } from "./index.js"

describe("core paketi", () => {
  it("kurulum tamam ve dışa aktarım çalışıyor", () => {
    expect(PACKAGE_NAME).toBe("@uyarla/core")
  })
})
```

- [ ] **Adım 5: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test`
Beklenen: FAIL — `src/index.ts` yok veya `PACKAGE_NAME` dışa aktarılmamış.

- [ ] **Adım 6: Minimal uygulamayı yaz**

`packages/core/src/index.ts`:

```ts
export const PACKAGE_NAME = "@uyarla/core"
```

- [ ] **Adım 7: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test`
Beklenen: PASS — 1 test geçti.

- [ ] **Adım 8: Docker servislerinin ayağa kalktığını doğrula**

Çalıştır: `pnpm db:up && docker compose ps`
Beklenen: `postgres` ve `redis` servisleri `running` durumunda; postgres sağlık kontrolü `healthy`.

- [ ] **Adım 9: Commit**

```bash
cp .env.example .env
git add package.json pnpm-workspace.yaml tsconfig.base.json docker-compose.yml .env.example packages/core
git commit -m "chore: pnpm monorepo iskeleti, Docker Compose ve core paketi"
```

---

### Görev 2: Veri modeli ve migration

Spec §5. `Analysis` modeli bu sprintin ölçüm altyapısının tabanı — `modelId`,
`durationMs`, `tokenUsage` alanları baştan konur (K-03).

**Dosyalar:**
- Oluştur: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/prisma/schema.prisma`, `packages/db/src/index.ts`
- Değiştir: `.env.example` (zaten `DATABASE_URL` var, dokunma)

**Arayüzler:**
- Tüketir: Görev 1'deki workspace kurulumu.
- Üretir: `@uyarla/db` paketinden `prisma` adlı tekil client; `Resume`,
  `ResumeVersion`, `JobPosting`, `Analysis`, `User` modelleri. Görev 11 ve 12
  bunları kullanır.

- [ ] **Adım 1: `packages/db` paketini oluştur**

`packages/db/package.json`:

```json
{
  "name": "@uyarla/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "typecheck": "tsc --noEmit",
    "test": "echo 'db paketinde birim testi yok' && exit 0"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0"
  },
  "devDependencies": {
    "prisma": "^5.20.0",
    "typescript": "^5.6.0"
  }
}
```

`packages/db/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Adım 2: Prisma şemasını yaz**

`packages/db/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
  resumes   Resume[]
}

model Resume {
  id        String          @id @default(cuid())
  userId    String
  user      User            @relation(fields: [userId], references: [id])
  filePath  String
  rawText   String          @db.Text
  status    ResumeStatus    @default(uploaded)
  createdAt DateTime        @default(now())
  versions  ResumeVersion[]
}

enum ResumeStatus {
  uploaded
  parsed
  failed
}

model ResumeVersion {
  id         String              @id @default(cuid())
  resumeId   String
  resume     Resume              @relation(fields: [resumeId], references: [id])
  profile    Json
  source     ResumeVersionSource
  versionNo  Int
  createdAt  DateTime            @default(now())
  analyses   Analysis[]

  @@unique([resumeId, versionNo])
}

enum ResumeVersionSource {
  parsed
  adapted
}

model JobPosting {
  id           String     @id @default(cuid())
  rawText      String     @db.Text
  requirements Json
  language     String
  seniority    String?
  createdAt    DateTime   @default(now())
  analyses     Analysis[]
}

model Analysis {
  id              String         @id @default(cuid())
  // Nullable: CV çıkarımı başarısız olursa ResumeVersion hiç oluşmaz, ama
  // spec §11 başarısız işlerin de Analysis kaydı yazmasını istiyor.
  resumeVersionId String?
  resumeVersion   ResumeVersion? @relation(fields: [resumeVersionId], references: [id])
  jobPostingId    String
  jobPosting      JobPosting     @relation(fields: [jobPostingId], references: [id])
  score           Float?
  result          Json?
  modelId         String
  durationMs      Int?
  tokenUsage      Int?
  status          AnalysisStatus @default(running)
  errorClass      String?
  createdAt       DateTime       @default(now())

  @@index([resumeVersionId, jobPostingId])
}

enum AnalysisStatus {
  running
  done
  failed
}
```

- [ ] **Adım 3: Client'ı dışa aktar**

`packages/db/src/index.ts`:

```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export * from "@prisma/client"
```

- [ ] **Adım 4: Migration'ı çalıştır**

Çalıştır:

```bash
pnpm install
pnpm --filter @uyarla/db exec prisma migrate dev --name sprint1_cekirdek
```

Beklenen: `packages/db/prisma/migrations/<tarih>_sprint1_cekirdek/` klasörü
oluştu, "Your database is now in sync with your schema" mesajı göründü.

- [ ] **Adım 5: Şemanın veritabanına uyduğunu doğrula**

Çalıştır: `pnpm --filter @uyarla/db exec prisma migrate status`
Beklenen: "Database schema is up to date!"

- [ ] **Adım 6: Commit**

```bash
git add packages/db pnpm-lock.yaml
git commit -m "feat: Prisma veri modeli ve ilk migration"
```

---

### Görev 3: Belge metin çıkarma ve dosya depolama

Spec §2 (kanca: `FileStore`), §11 (taranmış PDF tespiti). Kullanıcının en sık
karşılaşacağı hata sınıfı burada doğuyor; taranmış PDF ayrı mesaj almalı, yoksa
kullanıcı aynı dosyayı tekrar yükleyip aynı hatayı alır.

**Dosyalar:**
- Oluştur: `packages/core/src/errors.ts`
- Oluştur: `packages/core/src/storage/fileStore.ts`
- Oluştur: `packages/core/src/documents/extractText.ts`
- Test: `packages/core/src/documents/extractText.test.ts`
- Test: `packages/core/src/storage/fileStore.test.ts`
- Değiştir: `packages/core/package.json` (bağımlılık ekle)
- Değiştir: `packages/core/src/index.ts` (dışa aktarım)

**Arayüzler:**
- Üretir:
  - `class PermanentError extends Error { constructor(message: string, public code: string) }`
  - `class TransientError extends Error { constructor(message: string, public code: string) }`
  - `interface FileStore { save(buf: Buffer, name: string): Promise<string>; read(path: string): Promise<Buffer> }`
  - `class LocalFileStore implements FileStore { constructor(baseDir: string) }`
  - `extractText(buffer: Buffer, filename: string): Promise<string>`
- Görev 11 `extractText` ve `LocalFileStore`'u, Görev 10 ve 11 hata sınıflarını kullanır.

- [ ] **Adım 1: Bağımlılıkları ekle**

```bash
pnpm --filter @uyarla/core add pdf-parse mammoth
pnpm --filter @uyarla/core add -D @types/pdf-parse
```

- [ ] **Adım 2: Hata sınıflarını yaz**

`packages/core/src/errors.ts`:

```ts
/** Tekrar denemek anlamsız: girdi hatalı. Kullanıcıya gösterilir. */
export class PermanentError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = "PermanentError"
  }
}

/** Geçici: servis erişilemez, zaman aşımı. Tekrar denenir. */
export class TransientError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = "TransientError"
  }
}
```

- [ ] **Adım 3: Metin çıkarma testini yaz (başarısız olacak)**

`packages/core/src/documents/extractText.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { extractText } from "./extractText.js"
import { PermanentError } from "../errors.js"

const fixture = (name: string) =>
  readFileSync(join(__dirname, "__fixtures__", name))

describe("extractText", () => {
  it("DOCX dosyasından metni çıkarır", async () => {
    const text = await extractText(fixture("ornek-cv.docx"), "ornek-cv.docx")
    expect(text).toContain("Deneyim")
    expect(text.length).toBeGreaterThan(100)
  })

  it("PDF dosyasından metni çıkarır", async () => {
    const text = await extractText(fixture("ornek-cv.pdf"), "ornek-cv.pdf")
    expect(text).toContain("Deneyim")
  })

  it("metin katmanı olmayan PDF için ayrı hata kodu döner", async () => {
    await expect(
      extractText(fixture("taranmis.pdf"), "taranmis.pdf"),
    ).rejects.toMatchObject({ code: "scanned_pdf" })
  })

  it("desteklenmeyen uzantı için kalıcı hata fırlatır", async () => {
    await expect(
      extractText(Buffer.from("merhaba"), "cv.txt"),
    ).rejects.toBeInstanceOf(PermanentError)
  })
})
```

- [ ] **Adım 4: Test fixture'larını hazırla**

`packages/core/src/documents/__fixtures__/` klasörü oluştur ve içine üç dosya koy:

- `ornek-cv.docx` — içinde "Deneyim" başlığı ve en az 3 paragraf geçen bir Word belgesi
- `ornek-cv.pdf` — aynı içeriğin metin katmanlı PDF hâli
- `taranmis.pdf` — metin katmanı olmayan PDF

Taranmış PDF'i üretmek için:

```bash
cd packages/core/src/documents/__fixtures__
# ornek-cv.pdf'i goruntuye cevirip tekrar PDF yap (metin katmani kaybolur)
sips -s format png --out sayfa.png ornek-cv.pdf 2>/dev/null || \
  magick -density 150 ornek-cv.pdf sayfa.png
magick sayfa.png taranmis.pdf && rm sayfa.png
```

`magick` yoksa: macOS'ta Önizleme ile PDF'i açıp sayfanın ekran görüntüsünü al,
Önizleme'den PDF olarak dışa aktar. Sonucu doğrula — dosyadan metin çıkmamalı:

```bash
node -e "require('pdf-parse')(require('fs').readFileSync('taranmis.pdf')).then(r=>console.log('cikan metin uzunlugu:', r.text.trim().length))"
```

Beklenen çıktı: `cikan metin uzunlugu: 0` (veya 20'den küçük bir sayı).

- [ ] **Adım 5: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test extractText`
Beklenen: FAIL — `Cannot find module './extractText.js'`

- [ ] **Adım 6: Metin çıkarmayı uygula**

`packages/core/src/documents/extractText.ts`:

```ts
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { PermanentError } from "../errors.js"

/** Bu uzunluğun altındaki PDF metni, metin katmanı yok sayılır. */
const SCANNED_PDF_THRESHOLD = 20

export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop()

  if (ext === "pdf") {
    let parsed
    try {
      parsed = await pdfParse(buffer)
    } catch {
      throw new PermanentError(
        "Dosyanı okuyamadık. PDF veya DOCX olarak tekrar yüklemeyi dener misin?",
        "unreadable_file",
      )
    }
    const text = parsed.text.trim()
    if (text.length < SCANNED_PDF_THRESHOLD) {
      throw new PermanentError(
        "Bu PDF taranmış bir görüntü, içinde seçilebilir metin yok. " +
          "CV'ni Word veya metin katmanı olan bir PDF olarak yükler misin?",
        "scanned_pdf",
      )
    }
    return text
  }

  if (ext === "docx") {
    try {
      const { value } = await mammoth.extractRawText({ buffer })
      return value.trim()
    } catch {
      throw new PermanentError(
        "Dosyanı okuyamadık. PDF veya DOCX olarak tekrar yüklemeyi dener misin?",
        "unreadable_file",
      )
    }
  }

  throw new PermanentError(
    "Yalnızca PDF ve DOCX dosyalarını okuyabiliyoruz.",
    "unsupported_format",
  )
}
```

- [ ] **Adım 7: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test extractText`
Beklenen: PASS — 4 test geçti.

- [ ] **Adım 8: FileStore testini yaz**

`packages/core/src/storage/fileStore.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest"
import { rmSync, existsSync } from "node:fs"
import { LocalFileStore } from "./fileStore.js"

const BASE = "./.tmp-test-storage"

afterEach(() => {
  if (existsSync(BASE)) rmSync(BASE, { recursive: true, force: true })
})

describe("LocalFileStore", () => {
  it("kaydedip aynı içeriği geri okur", async () => {
    const store = new LocalFileStore(BASE)
    const path = await store.save(Buffer.from("merhaba dünya"), "cv.pdf")
    const back = await store.read(path)
    expect(back.toString()).toBe("merhaba dünya")
  })

  it("aynı ada sahip iki dosyayı birbirine yazmaz", async () => {
    const store = new LocalFileStore(BASE)
    const a = await store.save(Buffer.from("bir"), "cv.pdf")
    const b = await store.save(Buffer.from("iki"), "cv.pdf")
    expect(a).not.toBe(b)
    expect((await store.read(a)).toString()).toBe("bir")
    expect((await store.read(b)).toString()).toBe("iki")
  })
})
```

- [ ] **Adım 9: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test fileStore`
Beklenen: FAIL — `Cannot find module './fileStore.js'`

- [ ] **Adım 10: FileStore'u uygula**

`packages/core/src/storage/fileStore.ts`:

```ts
import { mkdir, writeFile, readFile } from "node:fs/promises"
import { join, dirname, extname } from "node:path"
import { randomUUID } from "node:crypto"

/**
 * Dosya depolama sözleşmesi. Sprint 3'te S3 uygulaması yazılır,
 * çağıran kod değişmez (spec §5).
 */
export interface FileStore {
  save(buffer: Buffer, filename: string): Promise<string>
  read(path: string): Promise<Buffer>
}

export class LocalFileStore implements FileStore {
  constructor(private readonly baseDir: string) {}

  async save(buffer: Buffer, filename: string): Promise<string> {
    const path = join(this.baseDir, `${randomUUID()}${extname(filename)}`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, buffer)
    return path
  }

  async read(path: string): Promise<Buffer> {
    return readFile(path)
  }
}
```

- [ ] **Adım 11: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test fileStore`
Beklenen: PASS — 2 test geçti.

- [ ] **Adım 12: Dışa aktarımları güncelle**

`packages/core/src/index.ts` içeriğini şununla değiştir:

```ts
export const PACKAGE_NAME = "@uyarla/core"

export * from "./errors.js"
export * from "./storage/fileStore.js"
export * from "./documents/extractText.js"
```

- [ ] **Adım 13: Tüm testleri çalıştır ve commit**

Çalıştır: `pnpm --filter @uyarla/core test`
Beklenen: PASS — 7 test geçti.

```bash
echo ".tmp-test-storage/" >> .gitignore
echo "storage/" >> .gitignore
git add packages/core .gitignore
git commit -m "feat: belge metin çıkarma, taranmış PDF tespiti ve dosya depolama"
```

---

### Görev 4: LLM sağlayıcı soyutlaması

Spec §6.1. Model adı bu görevden sonra kodun hiçbir yerinde geçmez (K-03).

**Spec'ten sapma — kayda geçir:** Spec `extract<T>(...): Promise<T>` yazıyor.
Uygulamada dönüş tipi `Promise<ExtractResult<T>>` olacak, çünkü `Analysis`
kaydının `tokenUsage` alanı (spec §5) çağrı başına token sayısını gerektiriyor
ve bu bilgiyi taşıyacak başka yer yok.

**Dosyalar:**
- Oluştur: `packages/core/src/llm/types.ts`
- Oluştur: `packages/core/src/llm/lmstudio.ts`
- Test: `packages/core/src/llm/lmstudio.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Görev 3'ten `TransientError`.
- Üretir:
  - `interface ExtractOptions { prompt: string; schemaName: string; schema: Record<string, unknown>; input: string }`
  - `interface ExtractResult<T> { data: T; tokens: number }`
  - `interface LlmProvider { extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>> }`
  - `interface EmbeddingProvider { embed(texts: string[]): Promise<number[][]> }`
  - `class LmStudioProvider implements LlmProvider { constructor(cfg: LlmConfig, client?: ChatClient) }`
  - `interface LlmConfig { baseUrl: string; model: string; timeoutMs: number }`
- Görev 6, 7 `LlmProvider`'ı; Görev 9 `EmbeddingProvider`'ı; Görev 10 ve 11 `ExtractResult`'ı kullanır.

- [ ] **Adım 1: Bağımlılığı ekle**

```bash
pnpm --filter @uyarla/core add openai
```

- [ ] **Adım 2: Arayüz tiplerini yaz**

`packages/core/src/llm/types.ts`:

```ts
export interface ExtractOptions {
  /** Sistem yönergesi: modelden ne istediğimiz. */
  prompt: string
  /** Şemanın adı; LM Studio json_schema kısıtında zorunlu. */
  schemaName: string
  /** JSON Schema — Zod şemasından üretilir (Görev 5). */
  schema: Record<string, unknown>
  /** İşlenecek ham metin. */
  input: string
}

export interface ExtractResult<T> {
  data: T
  /** Analysis.tokenUsage için (spec §5). */
  tokens: number
}

export interface LlmProvider {
  extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>>
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
}

export interface LlmConfig {
  baseUrl: string
  model: string
  timeoutMs: number
}

/** Sağlayıcı yapılandırmasını ortamdan okur. Model adı yalnızca burada. */
export function llmConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const baseUrl = env.LLM_BASE_URL
  const model = env.LLM_MODEL
  if (!baseUrl || !model) {
    throw new Error("LLM_BASE_URL ve LLM_MODEL ortam değişkenleri zorunlu")
  }
  return { baseUrl, model, timeoutMs: Number(env.LLM_TIMEOUT_MS ?? 60000) }
}
```

- [ ] **Adım 3: Sağlayıcı testini yaz (başarısız olacak)**

`packages/core/src/llm/lmstudio.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { LmStudioProvider } from "./lmstudio.js"
import { TransientError } from "../errors.js"

const cfg = { baseUrl: "http://localhost:1234/v1", model: "test-model", timeoutMs: 1000 }

const fakeClient = (impl: unknown) =>
  ({ chat: { completions: { create: impl } } }) as never

describe("LmStudioProvider", () => {
  it("şema kısıtını ve modeli isteğe geçirir, JSON'u çözümler", async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: '{"ad":"Elif"}' } }],
      usage: { total_tokens: 42 },
    })
    const provider = new LmStudioProvider(cfg, fakeClient(create))

    const result = await provider.extract<{ ad: string }>({
      prompt: "Adı çıkar",
      schemaName: "kisi",
      schema: { type: "object", properties: { ad: { type: "string" } } },
      input: "Adım Elif",
    })

    expect(result.data).toEqual({ ad: "Elif" })
    expect(result.tokens).toBe(42)

    const args = create.mock.calls[0]![0] as Record<string, unknown>
    expect(args.model).toBe("test-model")
    expect(args.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "kisi", strict: true },
    })
  })

  it("ağ hatasını geçici hataya çevirir", async () => {
    const provider = new LmStudioProvider(
      cfg,
      fakeClient(vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))),
    )
    await expect(
      provider.extract({ prompt: "p", schemaName: "s", schema: {}, input: "i" }),
    ).rejects.toBeInstanceOf(TransientError)
  })

  it("boş yanıtı geçici hata sayar", async () => {
    const provider = new LmStudioProvider(
      cfg,
      fakeClient(vi.fn().mockResolvedValue({ choices: [{ message: { content: "" } }] })),
    )
    await expect(
      provider.extract({ prompt: "p", schemaName: "s", schema: {}, input: "i" }),
    ).rejects.toBeInstanceOf(TransientError)
  })
})
```

- [ ] **Adım 4: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test lmstudio`
Beklenen: FAIL — `Cannot find module './lmstudio.js'`

- [ ] **Adım 5: Sağlayıcıyı uygula**

`packages/core/src/llm/lmstudio.ts`:

```ts
import OpenAI from "openai"
import { TransientError } from "../errors.js"
import type { ExtractOptions, ExtractResult, LlmConfig, LlmProvider } from "./types.js"

/** Test edilebilirlik için daraltılmış istemci yüzeyi. */
export interface ChatClient {
  chat: {
    completions: {
      create(args: Record<string, unknown>): Promise<{
        choices: Array<{ message: { content: string | null } }>
        usage?: { total_tokens?: number }
      }>
    }
  }
}

export class LmStudioProvider implements LlmProvider {
  private readonly client: ChatClient

  constructor(
    private readonly cfg: LlmConfig,
    client?: ChatClient,
  ) {
    this.client =
      client ??
      (new OpenAI({
        baseURL: cfg.baseUrl,
        apiKey: "lm-studio", // yerel sunucu anahtar doğrulamıyor
        timeout: cfg.timeoutMs,
      }) as unknown as ChatClient)
  }

  async extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>> {
    let response
    try {
      response = await this.client.chat.completions.create({
        model: this.cfg.model,
        messages: [
          { role: "system", content: opts.prompt },
          { role: "user", content: opts.input },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, schema: opts.schema, strict: true },
        },
        temperature: 0,
      })
    } catch (cause) {
      throw new TransientError(
        `LLM çağrısı başarısız: ${(cause as Error).message}`,
        "llm_unreachable",
      )
    }

    const content = response.choices[0]?.message.content
    if (!content) {
      throw new TransientError("LLM boş yanıt döndü", "llm_empty_response")
    }

    return {
      data: JSON.parse(content) as T,
      tokens: response.usage?.total_tokens ?? 0,
    }
  }
}
```

- [ ] **Adım 6: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test lmstudio`
Beklenen: PASS — 3 test geçti.

- [ ] **Adım 7: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./llm/types.js"
export * from "./llm/lmstudio.js"
```

```bash
pnpm --filter @uyarla/core test
git add packages/core pnpm-lock.yaml
git commit -m "feat: LLM sağlayıcı soyutlaması ve LM Studio uygulaması"
```

---

### Görev 5: Çıkarım şemaları

Spec §6.2. Tek kaynak: Zod ile tanım, JSON Schema'ya dönüşüm. Şema hem modeli
kısıtlar hem TypeScript tiplerini hem çalışma zamanı doğrulamasını üretir.

**Kritik tuzak:** LM Studio'nun `strict: true` kısıtı her alanın `required`
olmasını ve `additionalProperties: false` ister. Zod'da `.optional()` kullanırsan
alan `required` listesinden düşer ve kısıt reddedilir. **Opsiyonel alanlar için
`.optional()` değil `.nullable()` kullan** — model bilgi yoksa `null` yazar.

**Dosyalar:**
- Oluştur: `packages/core/src/schemas/resume.ts`
- Oluştur: `packages/core/src/schemas/job.ts`
- Test: `packages/core/src/schemas/schemas.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Üretir:
  - `ResumeProfileSchema` (Zod), tip `ResumeProfile`, `resumeProfileJsonSchema`
  - `ExperienceSchema`, tip `Experience`; `BulletSchema`, tip `Bullet`
  - `ResumeSegmentsSchema`, tip `ResumeSegments`, `resumeSegmentsJsonSchema`
  - `RequirementSchema`, tip `Requirement`
  - `JobPostingSchema`, tip `JobPostingData`, `jobPostingJsonSchema`
- Görev 6, 7, 10, 13 bu tipleri kullanır.

- [ ] **Adım 1: Bağımlılıkları ekle**

```bash
pnpm --filter @uyarla/core add zod zod-to-json-schema
```

- [ ] **Adım 2: Şema testini yaz (başarısız olacak)**

`packages/core/src/schemas/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { ResumeProfileSchema, resumeProfileJsonSchema } from "./resume.js"
import { JobPostingSchema, jobPostingJsonSchema } from "./job.js"

describe("CV profili şeması", () => {
  it("geçerli bir profili kabul eder", () => {
    const profile = {
      fullName: "Elif Yılmaz",
      headline: "Frontend Geliştirici",
      summary: "3 yıl React deneyimi",
      experience: [
        {
          company: "Acme",
          title: "Frontend Geliştirici",
          startDate: "2022-01",
          endDate: "halen",
          bullets: [
            { text: "React ile arayüz geliştirdi", sourceRef: "React ile arayüz geliştirdi" },
          ],
        },
      ],
      education: [{ school: "İTÜ", degree: "Lisans", field: "Bilgisayar Müh.", endDate: "2021" }],
      skills: ["React", "TypeScript"],
      languages: ["Türkçe", "İngilizce"],
      certifications: [],
    }
    expect(ResumeProfileSchema.parse(profile)).toEqual(profile)
  })

  it("deneyim maddesinde sourceRef zorunludur", () => {
    expect(() =>
      ResumeProfileSchema.parse({
        fullName: "A", headline: null, summary: null,
        experience: [{ company: "X", title: "Y", startDate: "2020", endDate: "2021",
          bullets: [{ text: "bir şey yaptı" }] }],
        education: [], skills: [], languages: [], certifications: [],
      }),
    ).toThrow()
  })

  it("JSON Schema'da hiçbir alan opsiyonel değil", () => {
    const props = Object.keys(
      (resumeProfileJsonSchema as { properties: Record<string, unknown> }).properties,
    )
    const required = (resumeProfileJsonSchema as { required: string[] }).required
    expect(required.sort()).toEqual(props.sort())
  })
})

describe("İlan şeması", () => {
  it("gereksinimleri tür ve önem bilgisiyle ayrıştırır", () => {
    const posting = {
      position: "Frontend Geliştirici",
      company: "Acme",
      seniority: "mid",
      language: "tr",
      requirements: [
        { text: "3 yıl React deneyimi", type: "experience", importance: "must", keywords: ["react"] },
        { text: "Takım çalışmasına yatkın", type: "soft", importance: "nice", keywords: ["takım çalışması"] },
      ],
    }
    expect(JobPostingSchema.parse(posting)).toEqual(posting)
  })

  it("tanımsız önem değerini reddeder", () => {
    expect(() =>
      JobPostingSchema.parse({
        position: "X", company: null, seniority: null, language: "tr",
        requirements: [{ text: "a", type: "skill", importance: "belki", keywords: [] }],
      }),
    ).toThrow()
  })

  it("JSON Schema'da hiçbir alan opsiyonel değil", () => {
    const props = Object.keys(
      (jobPostingJsonSchema as { properties: Record<string, unknown> }).properties,
    )
    const required = (jobPostingJsonSchema as { required: string[] }).required
    expect(required.sort()).toEqual(props.sort())
  })
})
```

- [ ] **Adım 3: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test schemas`
Beklenen: FAIL — `Cannot find module './resume.js'`

- [ ] **Adım 4: CV şemasını yaz**

`packages/core/src/schemas/resume.ts`:

```ts
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

/**
 * sourceRef: bu maddenin ham CV metnindeki birebir karşılığı.
 * Sprint 2'deki uydurma kontrolünün temeli (spec §6.2) — sonradan eklemek
 * tüm çıkarımı yeniden çalıştırmak demek olurdu.
 */
export const BulletSchema = z.object({
  text: z.string(),
  sourceRef: z.string(),
})

export const ExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  bullets: z.array(BulletSchema),
})

export const EducationSchema = z.object({
  school: z.string(),
  degree: z.string().nullable(),
  field: z.string().nullable(),
  endDate: z.string().nullable(),
})

export const ResumeProfileSchema = z.object({
  fullName: z.string().nullable(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  certifications: z.array(z.string()),
})

/** Aşama 1: ham metni kaba bloklara böler (spec §6.3). */
export const ResumeSegmentsSchema = z.object({
  summaryBlock: z.string(),
  experienceBlock: z.string(),
  educationBlock: z.string(),
  skillsBlock: z.string(),
})

export type Bullet = z.infer<typeof BulletSchema>
export type Experience = z.infer<typeof ExperienceSchema>
export type Education = z.infer<typeof EducationSchema>
export type ResumeProfile = z.infer<typeof ResumeProfileSchema>
export type ResumeSegments = z.infer<typeof ResumeSegmentsSchema>

const jsonSchemaOpts = { target: "jsonSchema7", $refStrategy: "none" } as const

export const resumeProfileJsonSchema = zodToJsonSchema(
  ResumeProfileSchema,
  jsonSchemaOpts,
) as Record<string, unknown>

export const resumeSegmentsJsonSchema = zodToJsonSchema(
  ResumeSegmentsSchema,
  jsonSchemaOpts,
) as Record<string, unknown>

export const experienceListJsonSchema = zodToJsonSchema(
  z.object({ experience: z.array(ExperienceSchema) }),
  jsonSchemaOpts,
) as Record<string, unknown>

export const educationListJsonSchema = zodToJsonSchema(
  z.object({ education: z.array(EducationSchema) }),
  jsonSchemaOpts,
) as Record<string, unknown>

export const skillsJsonSchema = zodToJsonSchema(
  z.object({
    skills: z.array(z.string()),
    languages: z.array(z.string()),
    certifications: z.array(z.string()),
  }),
  jsonSchemaOpts,
) as Record<string, unknown>
```

- [ ] **Adım 5: İlan şemasını yaz**

`packages/core/src/schemas/job.ts`:

```ts
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

export const RequirementSchema = z.object({
  /** Gereksinimin ilandaki hâli — kullanıcıya bu gösterilir. */
  text: z.string(),
  type: z.enum(["skill", "experience", "education", "soft"]),
  importance: z.enum(["must", "nice"]),
  /** Eşleştirme için aranacak biçimler; normalleştirme Görev 8'de. */
  keywords: z.array(z.string()),
})

export const JobPostingSchema = z.object({
  position: z.string(),
  company: z.string().nullable(),
  seniority: z.enum(["intern", "junior", "mid", "senior", "lead"]).nullable(),
  language: z.enum(["tr", "en"]),
  requirements: z.array(RequirementSchema),
})

export type Requirement = z.infer<typeof RequirementSchema>
export type JobPostingData = z.infer<typeof JobPostingSchema>

export const jobPostingJsonSchema = zodToJsonSchema(JobPostingSchema, {
  target: "jsonSchema7",
  $refStrategy: "none",
}) as Record<string, unknown>
```

- [ ] **Adım 6: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test schemas`
Beklenen: PASS — 6 test geçti.

- [ ] **Adım 7: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./schemas/resume.js"
export * from "./schemas/job.js"
```

```bash
pnpm --filter @uyarla/core test
git add packages/core pnpm-lock.yaml
git commit -m "feat: CV ve ilan çıkarım şemaları (Zod + JSON Schema)"
```

---

### Görev 6: CV çıkarımı (iki aşamalı)

Spec §6.3. Küçük modellerde uzun tek çağrının kalitesi hızla düşer; önce kaba
bölümleme, sonra her blok için ayrı ve kısa çağrı.

**Dosyalar:**
- Oluştur: `packages/core/src/extract/prompts.ts`
- Oluştur: `packages/core/src/extract/resume.ts`
- Test: `packages/core/src/extract/resume.test.ts`
- Test: `packages/core/src/extract/resume.integration.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Görev 4'ten `LlmProvider`, `ExtractResult`; Görev 5'ten `ResumeProfile`, `ResumeSegments` ve JSON şemaları.
- Üretir: `extractResumeProfile(llm: LlmProvider, rawText: string): Promise<ExtractResult<ResumeProfile>>`
- Görev 11 ve 13 bunu çağırır.

- [ ] **Adım 1: Prompt'ları yaz**

`packages/core/src/extract/prompts.ts`:

```ts
export const SEGMENT_PROMPT = `Sana bir özgeçmişin (CV) ham metni verilecek.
Metni dört bölüme ayır ve her bölümün ham metnini birebir kopyala:
- summaryBlock: kişisel özet, hakkında, profil bölümü
- experienceBlock: iş deneyimi bölümü
- educationBlock: eğitim bölümü
- skillsBlock: beceriler, diller, sertifikalar

Hiçbir metni değiştirme, özetleme veya yeniden yazma. Sadece böl.
Bir bölüm CV'de yoksa o alana boş metin yaz.`

export const EXPERIENCE_PROMPT = `Sana bir CV'nin iş deneyimi bölümü verilecek.
Her iş deneyimi için kurum, unvan, başlangıç ve bitiş tarihini çıkar.
Her deneyimin altındaki maddeleri bullets dizisine koy.

sourceRef alanına, o maddenin ham metindeki BİREBİR kopyasını yaz.
Metni değiştirme, kısaltma veya düzeltme. Bir kelimesini bile değiştirme.

Tarihler metinde nasıl yazıldıysa öyle kalsın ("2022-01", "Ocak 2022", "2022").
Devam eden işler için endDate alanına "halen" yaz.
CV'de olmayan hiçbir bilgi ekleme.`

export const EDUCATION_PROMPT = `Sana bir CV'nin eğitim bölümü verilecek.
Her eğitim kaydı için okul, derece, bölüm ve bitiş yılını çıkar.
Bilgi yoksa null yaz. CV'de olmayan hiçbir bilgi ekleme.`

export const SKILLS_PROMPT = `Sana bir CV'nin beceriler bölümü verilecek.
Becerileri, bilinen dilleri ve sertifikaları ayrı dizilere ayır.
Her beceriyi metinde yazıldığı gibi yaz. CV'de olmayan hiçbir beceri ekleme.`

export const JOB_PROMPT = `Sana bir iş ilanının metni verilecek.
Pozisyon adını, şirketi, kıdem seviyesini ve ilanın dilini belirle.

İlandaki her gereksinimi ayrı bir madde olarak çıkar:
- text: gereksinimin ilandaki hâli
- type: skill (teknik beceri), experience (deneyim), education (eğitim), soft (kişisel özellik)
- importance: "aranan", "şart", "zorunlu", "olmalı" gibi ifadeler must; "tercihen",
  "artı olur", "avantaj" gibi ifadeler nice
- keywords: o gereksinimi CV'de ararken kullanılacak kelimeler. Eş anlamlıları da ekle.
  Örnek: "3 yıl React deneyimi" için ["react", "react.js", "reactjs"]

Şirket adı ilanda yoksa null yaz. Kıdem belirtilmemişse null yaz.
İlanda olmayan hiçbir gereksinim ekleme.`
```

- [ ] **Adım 2: Çıkarım testini yaz (başarısız olacak)**

`packages/core/src/extract/resume.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { extractResumeProfile } from "./resume.js"
import type { ExtractOptions, LlmProvider } from "../llm/types.js"

/** Şema adına göre önceden belirlenmiş yanıt döndüren sahte sağlayıcı. */
function fakeLlm(responses: Record<string, unknown>): LlmProvider & { calls: ExtractOptions[] } {
  const calls: ExtractOptions[] = []
  return {
    calls,
    async extract<T>(opts: ExtractOptions) {
      calls.push(opts)
      const data = responses[opts.schemaName]
      if (data === undefined) throw new Error(`beklenmeyen şema: ${opts.schemaName}`)
      return { data: data as T, tokens: 10 }
    },
  }
}

const RESPONSES = {
  resume_segments: {
    summaryBlock: "3 yıl React deneyimi",
    experienceBlock: "Acme · Frontend Geliştirici · 2022-01 – halen\n- React ile arayüz geliştirdi",
    educationBlock: "İTÜ, Bilgisayar Mühendisliği, 2021",
    skillsBlock: "React, TypeScript",
  },
  resume_experience: {
    experience: [
      {
        company: "Acme", title: "Frontend Geliştirici",
        startDate: "2022-01", endDate: "halen",
        bullets: [{ text: "React ile arayüz geliştirdi", sourceRef: "React ile arayüz geliştirdi" }],
      },
    ],
  },
  resume_education: {
    education: [{ school: "İTÜ", degree: null, field: "Bilgisayar Mühendisliği", endDate: "2021" }],
  },
  resume_skills: { skills: ["React", "TypeScript"], languages: [], certifications: [] },
}

describe("extractResumeProfile", () => {
  it("bölümleme ve blok çıkarımlarını tek profilde birleştirir", async () => {
    const llm = fakeLlm(RESPONSES)
    const { data } = await extractResumeProfile(llm, "ham cv metni")

    expect(data.experience).toHaveLength(1)
    expect(data.experience[0]!.company).toBe("Acme")
    expect(data.education[0]!.school).toBe("İTÜ")
    expect(data.skills).toEqual(["React", "TypeScript"])
  })

  it("dört ayrı çağrı yapar: bölümleme + üç blok", async () => {
    const llm = fakeLlm(RESPONSES)
    await extractResumeProfile(llm, "ham cv metni")

    expect(llm.calls.map((c) => c.schemaName)).toEqual([
      "resume_segments", "resume_experience", "resume_education", "resume_skills",
    ])
  })

  it("token sayılarını toplar", async () => {
    const llm = fakeLlm(RESPONSES)
    const { tokens } = await extractResumeProfile(llm, "ham cv metni")
    expect(tokens).toBe(40)
  })

  it("boş blok için LLM'i çağırmaz", async () => {
    const llm = fakeLlm({
      ...RESPONSES,
      resume_segments: { ...RESPONSES.resume_segments, educationBlock: "   " },
    })
    const { data } = await extractResumeProfile(llm, "ham cv metni")

    expect(llm.calls.map((c) => c.schemaName)).not.toContain("resume_education")
    expect(data.education).toEqual([])
  })

  it("şemaya uymayan çıktıyı reddeder", async () => {
    const llm = fakeLlm({
      ...RESPONSES,
      resume_experience: { experience: [{ company: "Acme" }] },
    })
    await expect(extractResumeProfile(llm, "ham cv metni")).rejects.toThrow()
  })
})
```

- [ ] **Adım 3: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test extract/resume`
Beklenen: FAIL — `Cannot find module './resume.js'`

- [ ] **Adım 4: Çıkarımı uygula**

`packages/core/src/extract/resume.ts`:

```ts
import { z } from "zod"
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import {
  EducationSchema, ExperienceSchema, ResumeProfileSchema, ResumeSegmentsSchema,
  educationListJsonSchema, experienceListJsonSchema, resumeSegmentsJsonSchema, skillsJsonSchema,
} from "../schemas/resume.js"
import type { ResumeProfile } from "../schemas/resume.js"
import {
  EDUCATION_PROMPT, EXPERIENCE_PROMPT, SEGMENT_PROMPT, SKILLS_PROMPT,
} from "./prompts.js"

const ExperienceListSchema = z.object({ experience: z.array(ExperienceSchema) })
const EducationListSchema = z.object({ education: z.array(EducationSchema) })
const SkillsSchema = z.object({
  skills: z.array(z.string()),
  languages: z.array(z.string()),
  certifications: z.array(z.string()),
})

/**
 * İki aşamalı çıkarım (spec §6.3): önce kaba bölümleme, sonra blok başına
 * kısa ve odaklı çağrı. Boş bloklar için çağrı yapılmaz.
 */
export async function extractResumeProfile(
  llm: LlmProvider,
  rawText: string,
): Promise<ExtractResult<ResumeProfile>> {
  let tokens = 0

  const segments = await llm.extract({
    prompt: SEGMENT_PROMPT,
    schemaName: "resume_segments",
    schema: resumeSegmentsJsonSchema,
    input: rawText,
  })
  tokens += segments.tokens
  const blocks = ResumeSegmentsSchema.parse(segments.data)

  const experience = blocks.experienceBlock.trim()
    ? await llm.extract({
        prompt: EXPERIENCE_PROMPT,
        schemaName: "resume_experience",
        schema: experienceListJsonSchema,
        input: blocks.experienceBlock,
      })
    : null
  if (experience) tokens += experience.tokens

  const education = blocks.educationBlock.trim()
    ? await llm.extract({
        prompt: EDUCATION_PROMPT,
        schemaName: "resume_education",
        schema: educationListJsonSchema,
        input: blocks.educationBlock,
      })
    : null
  if (education) tokens += education.tokens

  const skills = blocks.skillsBlock.trim()
    ? await llm.extract({
        prompt: SKILLS_PROMPT,
        schemaName: "resume_skills",
        schema: skillsJsonSchema,
        input: blocks.skillsBlock,
      })
    : null
  if (skills) tokens += skills.tokens

  const profile = ResumeProfileSchema.parse({
    fullName: null,
    headline: null,
    summary: blocks.summaryBlock.trim() || null,
    experience: experience ? ExperienceListSchema.parse(experience.data).experience : [],
    education: education ? EducationListSchema.parse(education.data).education : [],
    ...(skills
      ? SkillsSchema.parse(skills.data)
      : { skills: [], languages: [], certifications: [] }),
  })

  return { data: profile, tokens }
}
```

- [ ] **Adım 5: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test extract/resume`
Beklenen: PASS — 5 test geçti.

- [ ] **Adım 6: Gerçek modelle tümleşik testi yaz**

`packages/core/src/extract/resume.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import { extractResumeProfile } from "./resume.js"

const CV = `Elif Yılmaz
Frontend Geliştirici

HAKKIMDA
3 yıldır React ile arayüz geliştiriyorum.

DENEYİM
Acme Teknoloji · Frontend Geliştirici · Ocak 2022 – halen
- React ve TypeScript ile müşteri paneli geliştirdim
- Sayfa yüklenme süresini %40 düşürdüm

EĞİTİM
İstanbul Teknik Üniversitesi, Bilgisayar Mühendisliği, 2021

BECERİLER
React, TypeScript, Next.js, Git`

describe("extractResumeProfile · gerçek model", () => {
  it("Türkçe CV'den deneyim ve becerileri çıkarır", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data } = await extractResumeProfile(llm, CV)

    expect(data.experience.length).toBeGreaterThanOrEqual(1)
    expect(data.experience[0]!.company).toMatch(/Acme/i)
    expect(data.skills.join(" ").toLowerCase()).toContain("react")
  }, 120_000)
})
```

- [ ] **Adım 7: Tümleşik test betiğini ekle**

`packages/core/package.json` içindeki `scripts` bölümüne ekle:

```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

`packages/core/vitest.integration.config.ts` oluştur:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
```

- [ ] **Adım 8: Tümleşik testi çalıştır**

LM Studio'nun ayakta ve `google/gemma-4-e4b` modelinin yüklü olduğundan emin ol.

Çalıştır: `pnpm --filter @uyarla/core test:integration`
Beklenen: PASS.

**Başarısız olursa bu bir sinyaldir, engel değil:** şema küçük model için fazla
karmaşık olabilir (spec §11). Prompt'u sadeleştir, gerekirse `ExperienceSchema`'dan
alan çıkar ve K1 notlarına yaz. Birim testleri geçtiği sürece Görev 7'ye devam et.

- [ ] **Adım 9: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./extract/resume.js"
export * from "./extract/prompts.js"
```

```bash
pnpm --filter @uyarla/core test
git add packages/core
git commit -m "feat: iki aşamalı CV çıkarımı"
```

---

### Görev 7: İlan çıkarımı

Spec §6.2. Tek çağrı yeter — ilan metni CV'den kısa ve daha düzenli.
Gereksinim listesinin kalitesi tüm skorun kalitesini belirler.

**Dosyalar:**
- Oluştur: `packages/core/src/extract/job.ts`
- Test: `packages/core/src/extract/job.test.ts`
- Test: `packages/core/src/extract/job.integration.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Görev 4'ten `LlmProvider`; Görev 5'ten `JobPostingData`, `jobPostingJsonSchema`; Görev 6'dan `JOB_PROMPT`.
- Üretir: `extractJobPosting(llm: LlmProvider, rawText: string): Promise<ExtractResult<JobPostingData>>`

- [ ] **Adım 1: Testi yaz (başarısız olacak)**

`packages/core/src/extract/job.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { extractJobPosting } from "./job.js"
import type { ExtractOptions, LlmProvider } from "../llm/types.js"

const VALID = {
  position: "Frontend Geliştirici",
  company: "Acme",
  seniority: "mid",
  language: "tr",
  requirements: [
    { text: "3 yıl React deneyimi", type: "experience", importance: "must", keywords: ["react"] },
  ],
}

const llmReturning = (data: unknown): LlmProvider => ({
  async extract<T>(_opts: ExtractOptions) {
    return { data: data as T, tokens: 25 }
  },
})

describe("extractJobPosting", () => {
  it("ilanı gereksinim listesiyle birlikte ayrıştırır", async () => {
    const { data, tokens } = await extractJobPosting(llmReturning(VALID), "ilan metni")
    expect(data.position).toBe("Frontend Geliştirici")
    expect(data.requirements[0]!.importance).toBe("must")
    expect(tokens).toBe(25)
  })

  it("doğru şemayı ve prompt'u geçirir", async () => {
    const extract = vi.fn().mockResolvedValue({ data: VALID, tokens: 1 })
    await extractJobPosting({ extract } as unknown as LlmProvider, "ilan metni")

    const opts = extract.mock.calls[0]![0] as ExtractOptions
    expect(opts.schemaName).toBe("job_posting")
    expect(opts.input).toBe("ilan metni")
    expect(opts.prompt).toContain("gereksinimi")
  })

  it("şemaya uymayan çıktıyı reddeder", async () => {
    await expect(
      extractJobPosting(llmReturning({ position: "X" }), "ilan metni"),
    ).rejects.toThrow()
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test extract/job`
Beklenen: FAIL — `Cannot find module './job.js'`

- [ ] **Adım 3: Uygula**

`packages/core/src/extract/job.ts`:

```ts
import type { ExtractResult, LlmProvider } from "../llm/types.js"
import { JobPostingSchema, jobPostingJsonSchema } from "../schemas/job.js"
import type { JobPostingData } from "../schemas/job.js"
import { JOB_PROMPT } from "./prompts.js"

export async function extractJobPosting(
  llm: LlmProvider,
  rawText: string,
): Promise<ExtractResult<JobPostingData>> {
  const { data, tokens } = await llm.extract({
    prompt: JOB_PROMPT,
    schemaName: "job_posting",
    schema: jobPostingJsonSchema,
    input: rawText,
  })
  return { data: JobPostingSchema.parse(data), tokens }
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test extract/job`
Beklenen: PASS — 3 test geçti.

- [ ] **Adım 5: Tümleşik testi yaz**

`packages/core/src/extract/job.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { LmStudioProvider } from "../llm/lmstudio.js"
import { llmConfigFromEnv } from "../llm/types.js"
import { extractJobPosting } from "./job.js"

const ILAN = `Frontend Geliştirici (Acme Teknoloji)

Aradığımız nitelikler:
- En az 3 yıl React deneyimi
- TypeScript bilgisi şarttır
- Git ile versiyon kontrolü

Tercihen:
- Next.js deneyimi
- Takım çalışmasına yatkın olmak`

describe("extractJobPosting · gerçek model", () => {
  it("zorunlu ve tercihen gereksinimleri ayırır", async () => {
    const llm = new LmStudioProvider(llmConfigFromEnv())
    const { data } = await extractJobPosting(llm, ILAN)

    expect(data.requirements.length).toBeGreaterThanOrEqual(4)
    expect(data.requirements.some((r) => r.importance === "must")).toBe(true)
    expect(data.requirements.some((r) => r.importance === "nice")).toBe(true)
    expect(
      data.requirements.flatMap((r) => r.keywords).join(" ").toLowerCase(),
    ).toContain("react")
  }, 120_000)
})
```

- [ ] **Adım 6: Tümleşik testi çalıştır**

Çalıştır: `pnpm --filter @uyarla/core test:integration`
Beklenen: PASS (iki tümleşik test).

`must`/`nice` ayrımı tutmazsa `JOB_PROMPT` içindeki örnekleri çoğalt; bu ayrım
skorun ağırlıklandırmasını doğrudan belirliyor.

- [ ] **Adım 7: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./extract/job.js"
```

```bash
pnpm --filter @uyarla/core test
git add packages/core
git commit -m "feat: ilan çıkarımı ve gereksinim listesi"
```

---

### Görev 8: Türkçe normalleştirme

Spec §7. Türkçe sondan eklemeli: ilan "yazılım geliştirici" derken CV'de
"yazılımcıyım" geçebilir.

**Tasarımın kilit varsayımı:** Ek soyma **simetriktir** — aynı fonksiyon hem ilan
hem CV tarafına uygulanır. Bu yüzden aşırı soyma tolere edilebilir ("geliştirici"
→ "geliştiri" her iki tarafta da aynı olur ve eşleşme tutar); asıl zararlı olan
eksik soymadır. Yine de çok kısa köklere inmemek için alt sınır konur.

**Dosyalar:**
- Oluştur: `packages/core/src/normalize/titles.ts`
- Oluştur: `packages/core/src/normalize/turkish.ts`
- Test: `packages/core/src/normalize/turkish.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Üretir:
  - `normalizeText(text: string): string`
  - `normalizeToken(word: string): string`
  - `normalizeTokens(text: string): string[]`
  - `containsKeyword(haystack: string, keyword: string): boolean`
- Görev 10 `containsKeyword`'ü kullanır.

- [ ] **Adım 1: Testi yaz (başarısız olacak)**

`packages/core/src/normalize/turkish.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { containsKeyword, normalizeText, normalizeToken, normalizeTokens } from "./turkish.js"

describe("normalizeText", () => {
  it("Türkçe büyük İ ve I harflerini doğru küçültür", () => {
    expect(normalizeText("İSTANBUL")).toBe("istanbul")
    expect(normalizeText("IŞIK")).toBe("ışık")
  })

  it("noktalama işaretlerini boşluğa çevirir", () => {
    expect(normalizeText("React, TypeScript; Next.js")).toBe("react typescript next js")
  })

  it("fazla boşlukları tekler", () => {
    expect(normalizeText("  React   Native ")).toBe("react native")
  })
})

describe("normalizeToken", () => {
  it("meslek eklerini soyar", () => {
    expect(normalizeToken("yazılımcıyım")).toBe("yazılım")
  })

  it("çoğul ve hâl eklerini soyar", () => {
    expect(normalizeToken("projelerde")).toBe("proje")
    expect(normalizeToken("deneyimim")).toBe("deneyim")
  })

  it("kısa kelimeleri bozmaz", () => {
    expect(normalizeToken("git")).toBe("git")
    expect(normalizeToken("sql")).toBe("sql")
  })

  it("aynı kavramın iki biçimini aynı köke indirir", () => {
    expect(normalizeToken("geliştiricisiniz")).toBe(normalizeToken("geliştirici"))
  })

  it("unvan eş anlamlılarını tek biçime çevirir", () => {
    expect(normalizeToken("önyüz")).toBe("frontend")
    expect(normalizeToken("frontend")).toBe("frontend")
  })
})

describe("normalizeTokens", () => {
  it("metni normalleştirilmiş köklere ayırır", () => {
    expect(normalizeTokens("React ile projelerde çalıştım")).toContain("proje")
  })
})

describe("containsKeyword", () => {
  it("çekimli biçimi yakalar", () => {
    expect(containsKeyword("5 yıldır yazılımcıyım", "yazılım")).toBe(true)
  })

  it("çok kelimeli anahtar kelimeyi yakalar", () => {
    expect(containsKeyword("Takım çalışmasına yatkınım", "takım çalışması")).toBe(true)
  })

  it("geçmeyen kelimeye false döner", () => {
    expect(containsKeyword("React ve TypeScript biliyorum", "kubernetes")).toBe(false)
  })

  it("kelime parçasını yanlışlıkla eşleştirmez", () => {
    expect(containsKeyword("Go dili biliyorum", "django")).toBe(false)
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test normalize`
Beklenen: FAIL — `Cannot find module './turkish.js'`

- [ ] **Adım 3: Unvan sözlüğünü yaz**

`packages/core/src/normalize/titles.ts`:

```ts
/**
 * Unvan ve teknoloji eş anlamlıları: varyant → kanonik biçim.
 * Anahtarlar normalizeText'ten geçmiş hâlde yazılır.
 *
 * Bu sözlük başlangıç hâlidir; değerlendirme setinde (Görev 13) ortaya çıkan
 * kaçırmalara göre genişletilir. Her ekleme bir eval kaçırmasını kapatmalı —
 * tahminle şişirilmez.
 */
export const TITLE_SYNONYMS: Record<string, string> = {
  // Rol
  "önyüz": "frontend",
  "onyuz": "frontend",
  "arayüz": "frontend",
  "front-end": "frontend",
  "arkayüz": "backend",
  "back-end": "backend",
  "tam yığın": "fullstack",
  "full-stack": "fullstack",
  "geliştirici": "gelistirici",
  "developer": "gelistirici",
  "yazılımcı": "yazılım gelistirici",
  "mühendis": "muhendis",
  "engineer": "muhendis",

  // Teknoloji yazım varyantları
  "react.js": "react",
  "reactjs": "react",
  "next.js": "nextjs",
  "node.js": "nodejs",
  "vue.js": "vue",
  "js": "javascript",
  "ts": "typescript",
  "postgres": "postgresql",
}
```

- [ ] **Adım 4: Normalleştirmeyi uygula**

`packages/core/src/normalize/turkish.ts`:

```ts
import { TITLE_SYNONYMS } from "./titles.js"

/** Ek soyulduktan sonra kökün inebileceği en kısa uzunluk. */
const MIN_STEM_LENGTH = 4

/**
 * Soyulacak ekler, uzundan kısaya. Sıra önemli: "larında" önce denenmezse
 * "da" soyulur ve geriye "ların" kalır.
 */
const SUFFIXES = [
  "larımızın", "lerimizin", "larınızın", "lerinizin",
  "cılığı", "ciliği", "culuğu", "cülüğü",
  "larında", "lerinde", "lığında", "liğinde",
  "sınız", "siniz", "sunuz", "sünüz",
  "cıyım", "ciyim", "cuyum", "cüyüm",
  "ların", "lerin", "ları", "leri",
  "lığı", "liği", "luğu", "lüğü",
  "lık", "lik", "luk", "lük",
  "dan", "den", "tan", "ten",
  "ında", "inde", "unda", "ünde",
  "cı", "ci", "cu", "cü", "çı", "çi", "çu", "çü",
  "lar", "ler",
  "da", "de", "ta", "te",
  "ım", "im", "um", "üm",
  "ı", "i", "u", "ü",
]

/** Türkçe duyarlı küçültme, noktalama temizliği, boşluk tekleme. */
export function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase("tr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}

/**
 * Tek kelimeyi köküne indirir ve eş anlamlıya çevirir.
 * Soyma simetriktir: aynı fonksiyon ilan ve CV tarafına uygulandığı için
 * aşırı soyma eşleşmeyi bozmaz.
 */
export function normalizeToken(word: string): string {
  const clean = normalizeText(word)
  const direct = TITLE_SYNONYMS[clean]
  if (direct) return direct

  let stem = clean
  let changed = true
  while (changed) {
    changed = false
    for (const suffix of SUFFIXES) {
      if (stem.endsWith(suffix) && stem.length - suffix.length >= MIN_STEM_LENGTH) {
        stem = stem.slice(0, -suffix.length)
        changed = true
        break
      }
    }
  }

  return TITLE_SYNONYMS[stem] ?? stem
}

/** Metni normalleştirilmiş köklere ayırır. */
export function normalizeTokens(text: string): string[] {
  const normalized = normalizeText(text)
  if (!normalized) return []
  return normalized.split(" ").map(normalizeToken)
}

/**
 * Anahtar kelimenin metinde geçip geçmediği. Çok kelimeli anahtar kelimelerde
 * tüm kökler ardışık olarak aranır; böylece "django" metindeki "go" ile
 * eşleşmez (kök karşılaştırması tam kelime düzeyinde).
 */
export function containsKeyword(haystack: string, keyword: string): boolean {
  const needle = normalizeTokens(keyword)
  if (needle.length === 0) return false

  const hay = normalizeTokens(haystack)
  for (let i = 0; i + needle.length <= hay.length; i++) {
    if (needle.every((part, j) => hay[i + j] === part)) return true
  }
  return false
}
```

- [ ] **Adım 5: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test normalize`
Beklenen: PASS — 13 test geçti.

Bir test tutmazsa `SUFFIXES` sırasını veya `MIN_STEM_LENGTH` değerini ayarla;
`TITLE_SYNONYMS`'e ekleme yapmadan önce testin gerçekten ek soymayla mı ilgili
olduğunu kontrol et.

- [ ] **Adım 6: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./normalize/turkish.js"
export * from "./normalize/titles.js"
```

```bash
pnpm --filter @uyarla/core test
git add packages/core
git commit -m "feat: Türkçe normalleştirme ve unvan eş anlamlı sözlüğü"
```

---

### Görev 9: Embedding sağlayıcı

Spec §6.1, §7. BGE-M3 (K-05). Gömülen birimler madde düzeyinde: her deneyim
maddesi ve her beceri ayrı vektör; CV bütün olarak gömülmez.

**Ön koşul:** LM Studio'ya BGE-M3 modelini yükle. LM Studio arayüzünde
"bge-m3" ara, indir ve yerel sunucuda etkinleştir. Ardından doğrula:

```bash
curl -s http://localhost:1234/v1/models | grep -i bge
```

Model kimliği çıktıda ne görünüyorsa `.env` dosyasındaki `EMBEDDING_MODEL`
değerine birebir onu yaz.

**Dosyalar:**
- Oluştur: `packages/core/src/llm/embedding.ts`
- Test: `packages/core/src/llm/embedding.test.ts`
- Test: `packages/core/src/llm/embedding.integration.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Görev 4'ten `EmbeddingProvider`, `TransientError`.
- Üretir:
  - `class LmStudioEmbeddingProvider implements EmbeddingProvider { constructor(cfg: EmbeddingConfig, client?: EmbeddingClient) }`
  - `interface EmbeddingConfig { baseUrl: string; model: string; timeoutMs: number }`
  - `embeddingConfigFromEnv(env?): EmbeddingConfig`
  - `cosineSimilarity(a: number[], b: number[]): number`
- Görev 10 `cosineSimilarity`'yi, Görev 11 ve 13 sağlayıcıyı kullanır.

- [ ] **Adım 1: Testi yaz (başarısız olacak)**

`packages/core/src/llm/embedding.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { LmStudioEmbeddingProvider, cosineSimilarity } from "./embedding.js"
import { TransientError } from "../errors.js"

const cfg = { baseUrl: "http://localhost:1234/v1", model: "bge-m3", timeoutMs: 1000 }
const fakeClient = (impl: unknown) => ({ embeddings: { create: impl } }) as never

describe("cosineSimilarity", () => {
  it("aynı vektör için 1 döner", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1)
  })

  it("dik vektörler için 0 döner", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it("sıfır vektörde 0 döner, NaN değil", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0)
  })

  it("farklı boyutlu vektörlerde hata fırlatır", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow()
  })
})

describe("LmStudioEmbeddingProvider", () => {
  it("metinleri tek toplu çağrıda gömer ve sırayı korur", async () => {
    const create = vi.fn().mockResolvedValue({
      data: [
        { index: 1, embedding: [0, 1] },
        { index: 0, embedding: [1, 0] },
      ],
    })
    const provider = new LmStudioEmbeddingProvider(cfg, fakeClient(create))

    const vectors = await provider.embed(["ilk", "ikinci"])

    expect(create).toHaveBeenCalledTimes(1)
    expect(vectors).toEqual([[1, 0], [0, 1]])
  })

  it("boş liste için çağrı yapmaz", async () => {
    const create = vi.fn()
    const provider = new LmStudioEmbeddingProvider(cfg, fakeClient(create))
    expect(await provider.embed([])).toEqual([])
    expect(create).not.toHaveBeenCalled()
  })

  it("ağ hatasını geçici hataya çevirir", async () => {
    const provider = new LmStudioEmbeddingProvider(
      cfg,
      fakeClient(vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))),
    )
    await expect(provider.embed(["a"])).rejects.toBeInstanceOf(TransientError)
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test embedding`
Beklenen: FAIL — `Cannot find module './embedding.js'`

- [ ] **Adım 3: Uygula**

`packages/core/src/llm/embedding.ts`:

```ts
import OpenAI from "openai"
import { TransientError } from "../errors.js"
import type { EmbeddingProvider } from "./types.js"

export interface EmbeddingConfig {
  baseUrl: string
  model: string
  timeoutMs: number
}

export function embeddingConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): EmbeddingConfig {
  const baseUrl = env.LLM_BASE_URL
  const model = env.EMBEDDING_MODEL
  if (!baseUrl || !model) {
    throw new Error("LLM_BASE_URL ve EMBEDDING_MODEL ortam değişkenleri zorunlu")
  }
  return { baseUrl, model, timeoutMs: Number(env.LLM_TIMEOUT_MS ?? 60000) }
}

export interface EmbeddingClient {
  embeddings: {
    create(args: Record<string, unknown>): Promise<{
      data: Array<{ index: number; embedding: number[] }>
    }>
  }
}

export class LmStudioEmbeddingProvider implements EmbeddingProvider {
  private readonly client: EmbeddingClient

  constructor(
    private readonly cfg: EmbeddingConfig,
    client?: EmbeddingClient,
  ) {
    this.client =
      client ??
      (new OpenAI({
        baseURL: cfg.baseUrl,
        apiKey: "lm-studio",
        timeout: cfg.timeoutMs,
      }) as unknown as EmbeddingClient)
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    let response
    try {
      response = await this.client.embeddings.create({
        model: this.cfg.model,
        input: texts,
      })
    } catch (cause) {
      throw new TransientError(
        `Embedding çağrısı başarısız: ${(cause as Error).message}`,
        "embedding_unreachable",
      )
    }

    // Sunucu sırayı garanti etmez; index alanına göre yerleştir.
    const vectors: number[][] = new Array(texts.length)
    for (const item of response.data) {
      vectors[item.index] = item.embedding
    }
    return vectors
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vektör boyutları uyuşmuyor: ${a.length} ve ${b.length}`)
  }

  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    normA += x * x
    normB += y * y
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test embedding`
Beklenen: PASS — 7 test geçti.

- [ ] **Adım 5: Tümleşik testi yaz**

`packages/core/src/llm/embedding.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { LmStudioEmbeddingProvider, cosineSimilarity, embeddingConfigFromEnv } from "./embedding.js"

describe("BGE-M3 · gerçek model", () => {
  it("Türkçe eş anlamlı ifadeleri alakasız ifadeden daha yakın konumlandırır", async () => {
    const provider = new LmStudioEmbeddingProvider(embeddingConfigFromEnv())
    const [ilan, yakin, uzak] = await provider.embed([
      "yazılım geliştirici olarak React deneyimi",
      "React ile arayüz geliştiriyorum",
      "muhasebe ve bordro süreçlerini yönettim",
    ])

    const benzer = cosineSimilarity(ilan!, yakin!)
    const alakasiz = cosineSimilarity(ilan!, uzak!)

    expect(benzer).toBeGreaterThan(alakasiz)
    expect(benzer).toBeGreaterThan(0.65) // spec §7 başlangıç eşiği
  }, 60_000)
})
```

- [ ] **Adım 6: Tümleşik testi çalıştır**

Çalıştır: `pnpm --filter @uyarla/core test:integration`
Beklenen: PASS.

Benzerlik 0.65'in altında kalıyorsa bu eşiğin fazla yüksek olduğunun ilk
sinyalidir — değeri not et, Görev 13'te eval verisiyle ayarlayacaksın.

- [ ] **Adım 7: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./llm/embedding.js"
```

```bash
pnpm --filter @uyarla/core test
git add packages/core
git commit -m "feat: BGE-M3 embedding sağlayıcısı ve kosinüs benzerliği"
```

---

### Görev 10: Skor servisi

Spec §7. Sprintin kalbi. Saf fonksiyon: LLM çağırmaz, veritabanına dokunmaz.

**Dosyalar:**
- Oluştur: `packages/core/src/score/config.ts`
- Oluştur: `packages/core/src/score/evidence.ts`
- Oluştur: `packages/core/src/score/score.ts`
- Test: `packages/core/src/score/evidence.test.ts`
- Test: `packages/core/src/score/score.test.ts`
- Değiştir: `packages/core/src/index.ts`

**Arayüzler:**
- Tüketir: Görev 5'ten `ResumeProfile`, `JobPostingData`, `Requirement`; Görev 8'den `containsKeyword`; Görev 9'dan `cosineSimilarity`.
- Üretir:
  - `interface ScoringConfig { mustWeight: number; niceWeight: number; semanticThreshold: number }`
  - `const DEFAULT_SCORING_CONFIG: ScoringConfig`
  - `interface Evidence { text: string; kind: "bullet" | "skill" | "education"; sourceRef: string | null }`
  - `collectEvidence(profile: ResumeProfile): Evidence[]`
  - `interface ScoreInput { profile; posting; evidence; evidenceVectors; requirementVectors }`
  - `interface RequirementResult { requirement; status; confidence; evidence; method }`
  - `interface ScoreResult { score: number; requirements: RequirementResult[]; missingKeywords: string[] }`
  - `score(input: ScoreInput, cfg?: ScoringConfig): ScoreResult`
- Görev 11, 12, 13 bunları kullanır.

- [ ] **Adım 1: Yapılandırmayı yaz**

`packages/core/src/score/config.ts`:

```ts
/**
 * Skor sabitleri. Tek yerde toplanır; değerlendirme setinde (Görev 13)
 * ayarlanacak — koda dağılmaz (spec §7).
 */
export interface ScoringConfig {
  /** "must" gereksinimlerinin ağırlığı. */
  mustWeight: number
  /** "nice" gereksinimlerinin ağırlığı. */
  niceWeight: number
  /** Bu değerin altındaki kosinüs benzerliği eşleşme sayılmaz. */
  semanticThreshold: number
}

/**
 * Başlangıç değerleri hipotezdir. Eşik bilinçli olarak yüksek: uydurma eşleşme
 * (yanlış pozitif), kaçırmadan daha zararlıdır — kullanıcıya olmayan bir
 * yetkinliği varmış gibi gösterir ve dürüstlük ilkesini çiğner (spec §7).
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  mustWeight: 2.0,
  niceWeight: 1.0,
  semanticThreshold: 0.65,
}
```

- [ ] **Adım 2: Kanıt toplama testini yaz (başarısız olacak)**

`packages/core/src/score/evidence.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { collectEvidence } from "./evidence.js"
import type { ResumeProfile } from "../schemas/resume.js"

const PROFILE: ResumeProfile = {
  fullName: "Elif", headline: null, summary: null,
  experience: [
    {
      company: "Acme", title: "Frontend Geliştirici",
      startDate: "2022", endDate: "halen",
      bullets: [
        { text: "React ile panel geliştirdi", sourceRef: "React ile panel geliştirdi" },
        { text: "Yükleme süresini düşürdü", sourceRef: "Yükleme süresini düşürdü" },
      ],
    },
  ],
  education: [{ school: "İTÜ", degree: "Lisans", field: "Bilgisayar Müh.", endDate: "2021" }],
  skills: ["React", "TypeScript"],
  languages: ["İngilizce"],
  certifications: [],
}

describe("collectEvidence", () => {
  it("her deneyim maddesini ayrı kanıt yapar", () => {
    const bullets = collectEvidence(PROFILE).filter((e) => e.kind === "bullet")
    expect(bullets).toHaveLength(2)
    expect(bullets[0]!.text).toContain("React ile panel")
  })

  it("deneyim maddesine unvan ve kurum bağlamını ekler", () => {
    const first = collectEvidence(PROFILE).find((e) => e.kind === "bullet")!
    expect(first.text).toContain("Frontend Geliştirici")
  })

  it("her beceriyi ayrı kanıt yapar", () => {
    const skills = collectEvidence(PROFILE).filter((e) => e.kind === "skill")
    expect(skills.map((e) => e.text)).toEqual(["React", "TypeScript"])
  })

  it("eğitimi kanıt olarak ekler", () => {
    const edu = collectEvidence(PROFILE).filter((e) => e.kind === "education")
    expect(edu).toHaveLength(1)
    expect(edu[0]!.text).toContain("İTÜ")
  })

  it("sourceRef'i deneyim maddelerinde korur, becerilerde null bırakır", () => {
    const all = collectEvidence(PROFILE)
    expect(all.find((e) => e.kind === "bullet")!.sourceRef).toBe("React ile panel geliştirdi")
    expect(all.find((e) => e.kind === "skill")!.sourceRef).toBeNull()
  })
})
```

- [ ] **Adım 3: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test score/evidence`
Beklenen: FAIL — `Cannot find module './evidence.js'`

- [ ] **Adım 4: Kanıt toplamayı uygula**

`packages/core/src/score/evidence.ts`:

```ts
import type { ResumeProfile } from "../schemas/resume.js"

/**
 * Eşleştirmenin ve kullanıcıya gösterilecek kanıtın birimi.
 * CV bütün olarak değil, madde düzeyinde gömülür (spec §7).
 */
export interface Evidence {
  /** Gömülecek ve kullanıcıya gösterilecek metin. */
  text: string
  kind: "bullet" | "skill" | "education"
  /** Ham CV metnindeki karşılığı; Sprint 2 uydurma kontrolü için. */
  sourceRef: string | null
}

export function collectEvidence(profile: ResumeProfile): Evidence[] {
  const evidence: Evidence[] = []

  for (const job of profile.experience) {
    for (const bullet of job.bullets) {
      // Unvan ve kurum bağlamı eklenir: "panel geliştirdi" tek başına
      // hangi rolde yapıldığını anlatmaz, anlamsal eşleşme zayıflar.
      evidence.push({
        text: `${job.title} · ${job.company}: ${bullet.text}`,
        kind: "bullet",
        sourceRef: bullet.sourceRef,
      })
    }
  }

  for (const skill of profile.skills) {
    evidence.push({ text: skill, kind: "skill", sourceRef: null })
  }

  for (const edu of profile.education) {
    const parts = [edu.school, edu.degree, edu.field].filter(Boolean)
    evidence.push({ text: parts.join(", "), kind: "education", sourceRef: null })
  }

  return evidence
}
```

- [ ] **Adım 5: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test score/evidence`
Beklenen: PASS — 5 test geçti.

- [ ] **Adım 6: Skor testini yaz (başarısız olacak)**

`packages/core/src/score/score.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { score } from "./score.js"
import { DEFAULT_SCORING_CONFIG } from "./config.js"
import type { Evidence } from "./evidence.js"
import type { ResumeProfile } from "../schemas/resume.js"
import type { JobPostingData, Requirement } from "../schemas/job.js"

const PROFILE: ResumeProfile = {
  fullName: null, headline: null, summary: null,
  experience: [], education: [], skills: [], languages: [], certifications: [],
}

const evidence = (text: string): Evidence => ({ text, kind: "bullet", sourceRef: text })

const req = (
  text: string,
  importance: "must" | "nice",
  keywords: string[],
): Requirement => ({ text, type: "skill", importance, keywords })

const posting = (requirements: Requirement[]): JobPostingData => ({
  position: "Geliştirici", company: null, seniority: null, language: "tr", requirements,
})

/** Belirli çiftleri yakın, kalanını uzak yapan basit sahte vektörler. */
const V = { yakin: [1, 0], orta: [0.8, 0.6], uzak: [0, 1] }

describe("score", () => {
  it("tam kelime eşleşmesinde güven 1.0 ve yöntem keyword olur", () => {
    const result = score({
      profile: PROFILE,
      posting: posting([req("React deneyimi", "must", ["react"])]),
      evidence: [evidence("React ile panel geliştirdim")],
      evidenceVectors: [V.uzak],
      requirementVectors: [V.yakin],
    })

    expect(result.requirements[0]!.status).toBe("matched")
    expect(result.requirements[0]!.confidence).toBe(1)
    expect(result.requirements[0]!.method).toBe("keyword")
    expect(result.score).toBe(100)
  })

  it("kelime eşleşmezse anlamsal eşleşmeye düşer", () => {
    const result = score({
      profile: PROFILE,
      posting: posting([req("Arayüz geliştirme", "must", ["kubernetes"])]),
      evidence: [evidence("React ile panel geliştirdim")],
      evidenceVectors: [V.yakin],
      requirementVectors: [V.yakin],
    })

    expect(result.requirements[0]!.status).toBe("matched")
    expect(result.requirements[0]!.method).toBe("semantic")
    expect(result.requirements[0]!.confidence).toBeCloseTo(1)
  })

  it("eşiğin altındaki benzerlik eksik sayılır", () => {
    const result = score({
      profile: PROFILE,
      posting: posting([req("Kubernetes", "must", ["kubernetes"])]),
      evidence: [evidence("React ile panel geliştirdim")],
      evidenceVectors: [V.uzak],
      requirementVectors: [V.yakin],
    })

    expect(result.requirements[0]!.status).toBe("missing")
    expect(result.requirements[0]!.evidence).toBeNull()
    expect(result.score).toBe(0)
  })

  it("must gereksinimi nice'ın iki katı ağırlıkta", () => {
    const result = score({
      profile: PROFILE,
      posting: posting([
        req("React", "must", ["react"]),
        req("Kubernetes", "nice", ["kubernetes"]),
      ]),
      evidence: [evidence("React biliyorum")],
      evidenceVectors: [V.uzak],
      requirementVectors: [V.yakin, V.yakin],
    })

    // (2.0 × 1.0 + 1.0 × 0) / 3.0 = 0.667
    expect(result.score).toBe(67)
  })

  it("eksik gereksinimlerin anahtar kelimelerini listeler", () => {
    const result = score({
      profile: PROFILE,
      posting: posting([
        req("React", "must", ["react"]),
        req("Kubernetes", "must", ["kubernetes", "k8s"]),
      ]),
      evidence: [evidence("React biliyorum")],
      evidenceVectors: [V.uzak],
      requirementVectors: [V.yakin, V.yakin],
    })

    expect(result.missingKeywords).toEqual(["kubernetes", "k8s"])
  })

  it("eşleşen gereksinim kanıt maddesini taşır", () => {
    const result = score({
      profile: PROFILE,
      posting: posting([req("React", "must", ["react"])]),
      evidence: [evidence("React ile panel geliştirdim")],
      evidenceVectors: [V.uzak],
      requirementVectors: [V.yakin],
    })

    expect(result.requirements[0]!.evidence!.text).toBe("React ile panel geliştirdim")
  })

  it("gereksinim yoksa skor 0 döner, NaN değil", () => {
    const result = score({
      profile: PROFILE, posting: posting([]),
      evidence: [], evidenceVectors: [], requirementVectors: [],
    })
    expect(result.score).toBe(0)
  })

  it("CV'de hiç kanıt yoksa her gereksinim eksik olur", () => {
    const result = score({
      profile: PROFILE,
      posting: posting([req("React", "must", ["react"])]),
      evidence: [], evidenceVectors: [], requirementVectors: [V.yakin],
    })
    expect(result.requirements[0]!.status).toBe("missing")
    expect(result.score).toBe(0)
  })

  it("eşik yapılandırmadan okunur", () => {
    const input = {
      profile: PROFILE,
      posting: posting([req("Arayüz", "must", ["kubernetes"])]),
      evidence: [evidence("React ile panel geliştirdim")],
      evidenceVectors: [V.orta],
      requirementVectors: [V.yakin],
    }

    const katı = score(input, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: 0.95 })
    const gevşek = score(input, { ...DEFAULT_SCORING_CONFIG, semanticThreshold: 0.5 })

    expect(katı.requirements[0]!.status).toBe("missing")
    expect(gevşek.requirements[0]!.status).toBe("matched")
  })
})
```

- [ ] **Adım 7: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core test score/score`
Beklenen: FAIL — `Cannot find module './score.js'`

- [ ] **Adım 8: Skor servisini uygula**

`packages/core/src/score/score.ts`:

```ts
import { cosineSimilarity } from "../llm/embedding.js"
import { containsKeyword } from "../normalize/turkish.js"
import type { JobPostingData, Requirement } from "../schemas/job.js"
import type { ResumeProfile } from "../schemas/resume.js"
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "./config.js"
import type { Evidence } from "./evidence.js"

export interface ScoreInput {
  profile: ResumeProfile
  posting: JobPostingData
  /** Kanıt birimleri; `evidenceVectors` ile aynı sırada. */
  evidence: Evidence[]
  evidenceVectors: number[][]
  /** `posting.requirements` ile aynı sırada. */
  requirementVectors: number[][]
}

export interface RequirementResult {
  requirement: Requirement
  status: "matched" | "missing"
  /** 0–1. Kelime eşleşmesinde 1, anlamsal eşleşmede benzerlik değeri. */
  confidence: number
  evidence: Evidence | null
  method: "keyword" | "semantic" | null
}

export interface ScoreResult {
  /** 0–100 arası tam sayı. */
  score: number
  requirements: RequirementResult[]
  /** Eksik gereksinimlerin anahtar kelimeleri; kullanıcıya gösterilen liste. */
  missingKeywords: string[]
}

/**
 * Üç aşamalı kanıt arama (spec §7):
 *   1. Tam kelime eşleşmesi → güven 1.0
 *   2. Anlamsal eşleşme, eşiği geçerse → güven = benzerlik
 *   3. Hiçbiri değilse → missing
 *
 * Saf fonksiyon: LLM çağırmaz, veritabanına dokunmaz.
 */
export function score(
  input: ScoreInput,
  cfg: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ScoreResult {
  const results: RequirementResult[] = input.posting.requirements.map(
    (requirement, i) => matchRequirement(requirement, i, input, cfg),
  )

  let weighted = 0
  let totalWeight = 0
  for (const result of results) {
    const weight =
      result.requirement.importance === "must" ? cfg.mustWeight : cfg.niceWeight
    totalWeight += weight
    weighted += weight * result.confidence
  }

  return {
    score: totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 100),
    requirements: results,
    missingKeywords: results
      .filter((r) => r.status === "missing")
      .flatMap((r) => r.requirement.keywords),
  }
}

function matchRequirement(
  requirement: Requirement,
  index: number,
  input: ScoreInput,
  cfg: ScoringConfig,
): RequirementResult {
  // 1. Tam kelime eşleşmesi
  for (let i = 0; i < input.evidence.length; i++) {
    const item = input.evidence[i]!
    const hit = requirement.keywords.some((kw) => containsKeyword(item.text, kw))
    if (hit) {
      return {
        requirement, status: "matched", confidence: 1, evidence: item, method: "keyword",
      }
    }
  }

  // 2. Anlamsal eşleşme
  const reqVector = input.requirementVectors[index]
  if (reqVector) {
    let best: { similarity: number; evidence: Evidence } | null = null
    for (let i = 0; i < input.evidence.length; i++) {
      const vector = input.evidenceVectors[i]
      const item = input.evidence[i]
      if (!vector || !item) continue
      const similarity = cosineSimilarity(reqVector, vector)
      if (!best || similarity > best.similarity) best = { similarity, evidence: item }
    }

    if (best && best.similarity >= cfg.semanticThreshold) {
      return {
        requirement,
        status: "matched",
        confidence: best.similarity,
        evidence: best.evidence,
        method: "semantic",
      }
    }
  }

  // 3. Eksik
  return { requirement, status: "missing", confidence: 0, evidence: null, method: null }
}
```

- [ ] **Adım 9: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core test score`
Beklenen: PASS — 14 test geçti (5 kanıt + 9 skor).

- [ ] **Adım 10: Dışa aktar ve commit**

`packages/core/src/index.ts` sonuna ekle:

```ts
export * from "./score/config.js"
export * from "./score/evidence.js"
export * from "./score/score.js"
```

```bash
pnpm --filter @uyarla/core test
git add packages/core
git commit -m "feat: hibrit skor servisi ve kanıt toplama"
```

---

### Görev 11: Kuyruk ve işçi süreci

Spec §8. Tek iş türü: `analyze`. Aşamalar iş içinde sırayla ilerler; ayrı
kuyruk işlerine bölünmez.

Hattın kendisi (`runAnalysis`) bağımlılıkları enjekte edilmiş saf bir
orkestratördür — BullMQ ve Prisma olmadan test edilir.

**Dosyalar:**
- Oluştur: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/vitest.config.ts`
- Oluştur: `apps/worker/src/types.ts`
- Oluştur: `apps/worker/src/pipeline.ts`
- Oluştur: `apps/worker/src/store.ts`
- Oluştur: `apps/worker/src/queue.ts`
- Oluştur: `apps/worker/src/index.ts`
- Test: `apps/worker/src/pipeline.test.ts`

**Arayüzler:**
- Tüketir: `@uyarla/core`'dan `extractResumeProfile`, `extractJobPosting`,
  `collectEvidence`, `score`, `LlmProvider`, `EmbeddingProvider`,
  `PermanentError`, `TransientError`; `@uyarla/db`'den `prisma`.
- Üretir:
  - `interface AnalysisStore` (aşağıda tam tanım)
  - `runAnalysis(deps: PipelineDeps, input: PipelineInput): Promise<string>` — dönüş: `analysisId`
  - `ANALYZE_QUEUE = "analyze"`, `interface AnalyzeJobData { resumeId: string; jobPostingId: string }`
- Görev 12 `ANALYZE_QUEUE` ve `AnalyzeJobData`'yı kullanır.

- [ ] **Adım 1: Worker paketini oluştur**

`apps/worker/package.json`:

```json
{
  "name": "@uyarla/worker",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@uyarla/core": "workspace:*",
    "@uyarla/db": "workspace:*",
    "bullmq": "^5.20.0",
    "ioredis": "^5.4.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`apps/worker/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`apps/worker/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
})
```

Çalıştır: `pnpm install`

- [ ] **Adım 2: Hat tiplerini yaz**

`apps/worker/src/types.ts`:

```ts
import type {
  EmbeddingProvider, Evidence, JobPostingData, LlmProvider, ResumeProfile, ScoreResult,
} from "@uyarla/core"

/**
 * Hattın ihtiyaç duyduğu kalıcılık işlemleri. Prisma doğrudan çağrılmaz;
 * hat böylece veritabanı olmadan test edilebilir.
 */
export interface AnalysisStore {
  getResumeText(resumeId: string): Promise<string>
  getJobPostingText(jobPostingId: string): Promise<string>
  saveResumeVersion(resumeId: string, profile: ResumeProfile): Promise<string>
  saveJobPostingData(jobPostingId: string, data: JobPostingData): Promise<void>
  createAnalysis(input: { jobPostingId: string; modelId: string }): Promise<string>
  attachResumeVersion(analysisId: string, resumeVersionId: string): Promise<void>
  completeAnalysis(input: {
    analysisId: string
    score: number
    result: ScoreResult
    durationMs: number
    tokenUsage: number
  }): Promise<void>
  failAnalysis(analysisId: string, errorClass: string): Promise<void>
}

export interface PipelineDeps {
  llm: LlmProvider
  embedding: EmbeddingProvider
  store: AnalysisStore
  modelId: string
  /** Aşama bildirimi; arayüzdeki ilerleme metinleri için (spec §8). */
  onProgress?: (stage: PipelineStage) => void
  now?: () => number
}

export type PipelineStage =
  | "cv_okunuyor"
  | "ilan_okunuyor"
  | "karsilastiriliyor"
  | "tamamlandi"

export interface PipelineInput {
  resumeId: string
  jobPostingId: string
}

export type { Evidence }
```

- [ ] **Adım 3: Hat testini yaz (başarısız olacak)**

`apps/worker/src/pipeline.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { PermanentError, TransientError } from "@uyarla/core"
import { runAnalysis } from "./pipeline.js"
import type { AnalysisStore, PipelineDeps, PipelineStage } from "./types.js"

const PROFILE = {
  fullName: "Elif", headline: null, summary: null,
  experience: [
    {
      company: "Acme", title: "Frontend Geliştirici",
      startDate: "2022", endDate: "halen",
      bullets: [{ text: "React ile panel geliştirdi", sourceRef: "React ile panel geliştirdi" }],
    },
  ],
  education: [], skills: ["React"], languages: [], certifications: [],
}

const POSTING = {
  position: "Frontend Geliştirici", company: "Acme", seniority: "mid", language: "tr",
  requirements: [
    { text: "React deneyimi", type: "skill", importance: "must", keywords: ["react"] },
  ],
}

function fakeStore(overrides: Partial<AnalysisStore> = {}): AnalysisStore {
  return {
    getResumeText: async () => "ham cv",
    getJobPostingText: async () => "ham ilan",
    saveResumeVersion: async () => "rv-1",
    saveJobPostingData: async () => {},
    createAnalysis: async () => "an-1",
    attachResumeVersion: async () => {},
    completeAnalysis: async () => {},
    failAnalysis: async () => {},
    ...overrides,
  }
}

function fakeDeps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  let call = 0
  return {
    modelId: "test-model",
    llm: {
      async extract<T>() {
        call++
        // Sıra: segments, experience, education?, skills?, job
        const responses: unknown[] = [
          { summaryBlock: "", experienceBlock: "Acme...", educationBlock: "", skillsBlock: "React" },
          { experience: PROFILE.experience },
          { skills: ["React"], languages: [], certifications: [] },
          POSTING,
        ]
        return { data: responses[call - 1] as T, tokens: 10 }
      },
    },
    embedding: { embed: async (texts) => texts.map(() => [1, 0]) },
    store: fakeStore(),
    now: () => 1000,
    ...overrides,
  }
}

describe("runAnalysis", () => {
  it("analysisId döner ve analizi tamamlar", async () => {
    const completeAnalysis = vi.fn()
    const deps = fakeDeps({ store: fakeStore({ completeAnalysis }) })

    const id = await runAnalysis(deps, { resumeId: "r-1", jobPostingId: "j-1" })

    expect(id).toBe("an-1")
    expect(completeAnalysis).toHaveBeenCalledOnce()
    const arg = completeAnalysis.mock.calls[0]![0]
    expect(arg.analysisId).toBe("an-1")
    expect(arg.score).toBe(100)
  })

  it("token sayılarını toplayıp kaydeder", async () => {
    const completeAnalysis = vi.fn()
    await runAnalysis(fakeDeps({ store: fakeStore({ completeAnalysis }) }), {
      resumeId: "r-1", jobPostingId: "j-1",
    })
    expect(completeAnalysis.mock.calls[0]![0].tokenUsage).toBeGreaterThan(0)
  })

  it("aşamaları sırayla bildirir", async () => {
    const stages: PipelineStage[] = []
    await runAnalysis(fakeDeps({ onProgress: (s) => stages.push(s) }), {
      resumeId: "r-1", jobPostingId: "j-1",
    })
    expect(stages).toEqual(["cv_okunuyor", "ilan_okunuyor", "karsilastiriliyor", "tamamlandi"])
  })

  it("kalıcı hatada analizi hata koduyla başarısız işaretler ve yeniden fırlatır", async () => {
    const failAnalysis = vi.fn()
    const deps = fakeDeps({
      store: fakeStore({ failAnalysis }),
      llm: {
        async extract() {
          throw new PermanentError("bozuk", "unreadable_file")
        },
      },
    })

    await expect(
      runAnalysis(deps, { resumeId: "r-1", jobPostingId: "j-1" }),
    ).rejects.toBeInstanceOf(PermanentError)
    expect(failAnalysis).toHaveBeenCalledWith("an-1", "unreadable_file")
  })

  it("geçici hatayı da kaydeder ve yeniden fırlatır (BullMQ tekrar denesin)", async () => {
    const failAnalysis = vi.fn()
    const deps = fakeDeps({
      store: fakeStore({ failAnalysis }),
      embedding: {
        async embed(): Promise<number[][]> {
          throw new TransientError("erişilemedi", "embedding_unreachable")
        },
      },
    })

    await expect(
      runAnalysis(deps, { resumeId: "r-1", jobPostingId: "j-1" }),
    ).rejects.toBeInstanceOf(TransientError)
    expect(failAnalysis).toHaveBeenCalledWith("an-1", "embedding_unreachable")
  })

  it("sınıflandırılmamış hatayı unknown olarak kaydeder", async () => {
    const failAnalysis = vi.fn()
    const deps = fakeDeps({
      store: fakeStore({ failAnalysis }),
      llm: {
        async extract(): Promise<never> {
          throw new Error("beklenmeyen")
        },
      },
    })

    await expect(
      runAnalysis(deps, { resumeId: "r-1", jobPostingId: "j-1" }),
    ).rejects.toThrow()
    expect(failAnalysis).toHaveBeenCalledWith("an-1", "unknown")
  })
})
```

- [ ] **Adım 4: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/worker test`
Beklenen: FAIL — `Cannot find module './pipeline.js'`

- [ ] **Adım 5: Hattı uygula**

`apps/worker/src/pipeline.ts`:

```ts
import {
  PermanentError, TransientError, collectEvidence, extractJobPosting,
  extractResumeProfile, score,
} from "@uyarla/core"
import type { PipelineDeps, PipelineInput } from "./types.js"

/**
 * analyze işinin aşama sırası (spec §8):
 * çıkarım → embedding → skor → Analysis kaydı.
 *
 * Başarısız işler de Analysis kaydı yazar (spec §11); hata sınıfı
 * errorClass alanına düşer, sonra yeniden fırlatılır ki BullMQ
 * geçici hatalarda tekrar denesin.
 */
export async function runAnalysis(
  deps: PipelineDeps,
  input: PipelineInput,
): Promise<string> {
  const now = deps.now ?? Date.now
  const startedAt = now()

  const analysisId = await deps.store.createAnalysis({
    jobPostingId: input.jobPostingId,
    modelId: deps.modelId,
  })

  try {
    deps.onProgress?.("cv_okunuyor")
    const resumeText = await deps.store.getResumeText(input.resumeId)
    const profile = await extractResumeProfile(deps.llm, resumeText)
    const resumeVersionId = await deps.store.saveResumeVersion(
      input.resumeId,
      profile.data,
    )
    await deps.store.attachResumeVersion(analysisId, resumeVersionId)

    deps.onProgress?.("ilan_okunuyor")
    const postingText = await deps.store.getJobPostingText(input.jobPostingId)
    const posting = await extractJobPosting(deps.llm, postingText)
    await deps.store.saveJobPostingData(input.jobPostingId, posting.data)

    deps.onProgress?.("karsilastiriliyor")
    const evidence = collectEvidence(profile.data)
    // Tek toplu çağrı: önce kanıtlar, sonra gereksinimler (spec §7).
    const evidenceTexts = evidence.map((e) => e.text)
    const requirementTexts = posting.data.requirements.map((r) => r.text)
    const vectors = await deps.embedding.embed([...evidenceTexts, ...requirementTexts])

    const result = score({
      profile: profile.data,
      posting: posting.data,
      evidence,
      evidenceVectors: vectors.slice(0, evidenceTexts.length),
      requirementVectors: vectors.slice(evidenceTexts.length),
    })

    await deps.store.completeAnalysis({
      analysisId,
      score: result.score,
      result,
      durationMs: now() - startedAt,
      tokenUsage: profile.tokens + posting.tokens,
    })

    deps.onProgress?.("tamamlandi")
    return analysisId
  } catch (error) {
    await deps.store.failAnalysis(analysisId, classify(error))
    throw error
  }
}

function classify(error: unknown): string {
  if (error instanceof PermanentError || error instanceof TransientError) {
    return error.code
  }
  return "unknown"
}
```

- [ ] **Adım 6: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/worker test`
Beklenen: PASS — 6 test geçti.

- [ ] **Adım 7: Prisma destekli store'u yaz**

`apps/worker/src/store.ts`:

```ts
import { prisma } from "@uyarla/db"
import { PermanentError } from "@uyarla/core"
import type { AnalysisStore } from "./types.js"

export const prismaStore: AnalysisStore = {
  async getResumeText(resumeId) {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } })
    if (!resume) throw new PermanentError("CV bulunamadı", "resume_not_found")
    return resume.rawText
  },

  async getJobPostingText(jobPostingId) {
    const posting = await prisma.jobPosting.findUnique({ where: { id: jobPostingId } })
    if (!posting) throw new PermanentError("İlan bulunamadı", "posting_not_found")
    return posting.rawText
  },

  async saveResumeVersion(resumeId, profile) {
    const count = await prisma.resumeVersion.count({ where: { resumeId } })
    const version = await prisma.resumeVersion.create({
      data: {
        resumeId,
        profile: profile as unknown as object,
        source: "parsed",
        versionNo: count + 1,
      },
    })
    await prisma.resume.update({ where: { id: resumeId }, data: { status: "parsed" } })
    return version.id
  },

  async saveJobPostingData(jobPostingId, data) {
    await prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: {
        requirements: data.requirements as unknown as object,
        language: data.language,
        seniority: data.seniority,
      },
    })
  },

  async createAnalysis({ jobPostingId, modelId }) {
    const analysis = await prisma.analysis.create({
      data: { jobPostingId, modelId, status: "running" },
    })
    return analysis.id
  },

  async attachResumeVersion(analysisId, resumeVersionId) {
    await prisma.analysis.update({ where: { id: analysisId }, data: { resumeVersionId } })
  },

  async completeAnalysis({ analysisId, score, result, durationMs, tokenUsage }) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        score, result: result as unknown as object,
        durationMs, tokenUsage, status: "done",
      },
    })
  },

  async failAnalysis(analysisId, errorClass) {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "failed", errorClass },
    })
  },
}
```

- [ ] **Adım 8: Kuyruğu tanımla**

`apps/worker/src/queue.ts`:

```ts
export const ANALYZE_QUEUE = "analyze"

export interface AnalyzeJobData {
  resumeId: string
  jobPostingId: string
}

/** BullMQ iş seçenekleri: geçici hatalarda 3 deneme, üstel geri çekilme (spec §11). */
export const ANALYZE_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
}
```

- [ ] **Adım 9: İşçi sürecini yaz**

`apps/worker/src/index.ts`:

```ts
import { Worker } from "bullmq"
import IORedis from "ioredis"
import {
  LmStudioEmbeddingProvider, LmStudioProvider, PermanentError,
  embeddingConfigFromEnv, llmConfigFromEnv,
} from "@uyarla/core"
import { runAnalysis } from "./pipeline.js"
import { prismaStore } from "./store.js"
import { ANALYZE_QUEUE, type AnalyzeJobData } from "./queue.js"

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
})

const llmConfig = llmConfigFromEnv()
const llm = new LmStudioProvider(llmConfig)
const embedding = new LmStudioEmbeddingProvider(embeddingConfigFromEnv())

const worker = new Worker<AnalyzeJobData, string>(
  ANALYZE_QUEUE,
  async (job) => {
    return runAnalysis(
      {
        llm,
        embedding,
        store: prismaStore,
        modelId: llmConfig.model,
        onProgress: (stage) => void job.updateProgress({ stage }),
      },
      { resumeId: job.data.resumeId, jobPostingId: job.data.jobPostingId },
    )
  },
  { connection, concurrency: 2 },
)

// Kalıcı hatalarda tekrar denemek anlamsız; işi hemen bitir (spec §11).
worker.on("failed", (job, error) => {
  if (error instanceof PermanentError && job) {
    void job.discard()
  }
  console.error(`[analyze] iş başarısız: ${job?.id}`, error.message)
})

worker.on("completed", (job, analysisId) => {
  console.log(`[analyze] tamamlandı: iş ${job.id} → analiz ${analysisId}`)
})

console.log(`[worker] ${ANALYZE_QUEUE} kuyruğu dinleniyor, model: ${llmConfig.model}`)
```

- [ ] **Adım 10: İşçinin ayağa kalktığını doğrula**

Çalıştır: `pnpm db:up && pnpm --filter @uyarla/worker start`
Beklenen: `[worker] analyze kuyruğu dinleniyor, model: google/gemma-4-e4b`
Ctrl+C ile durdur.

- [ ] **Adım 11: Commit**

```bash
pnpm --filter @uyarla/worker test
git add apps/worker packages/db pnpm-lock.yaml
git commit -m "feat: analyze kuyruğu, işçi süreci ve analiz hattı"
```

---

### Görev 12: API route'ları ve test arayüzü

Spec §9. Markasız test arayüzü (K-01). API route'ları ince: doğrula, kuyruğa
at, durum döndür. İş mantığı burada bulunmaz.

**Dosyalar:**
- Oluştur: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.mjs`, `apps/web/vitest.config.ts`
- Oluştur: `apps/web/app/layout.tsx`, `apps/web/app/globals.css`
- Oluştur: `apps/web/lib/queue.ts`
- Oluştur: `apps/web/app/api/analyze/route.ts`
- Oluştur: `apps/web/app/api/analyze/[id]/route.ts`
- Oluştur: `apps/web/app/test/page.tsx`
- Test: `apps/web/lib/upload.test.ts`
- Oluştur: `apps/web/lib/upload.ts`

**Arayüzler:**
- Tüketir: `@uyarla/core`'dan `extractText`, `LocalFileStore`, `PermanentError`;
  `@uyarla/db`'den `prisma`; `@uyarla/worker`'dan `ANALYZE_QUEUE`,
  `ANALYZE_JOB_OPTIONS`, `AnalyzeJobData`.
- Üretir: `POST /api/analyze` → `{ jobId }`; `GET /api/analyze/:id` →
  `{ status, stage?, score?, result?, error? }`.

- [ ] **Adım 1: Web paketini oluştur**

`apps/web/package.json`:

```json
{
  "name": "@uyarla/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@uyarla/core": "workspace:*",
    "@uyarla/db": "workspace:*",
    "@uyarla/worker": "workspace:*",
    "bullmq": "^5.20.0",
    "ioredis": "^5.4.0",
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`apps/worker/package.json` içindeki `exports` alanını ekle (web'in kuyruk
sabitlerini import edebilmesi için):

```json
"exports": { "./queue": "./src/queue.ts" }
```

`apps/web/next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@uyarla/core", "@uyarla/db", "@uyarla/worker"],
}
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"]
}
```

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { include: ["lib/**/*.test.ts"] },
})
```

Çalıştır: `pnpm install`

- [ ] **Adım 2: Yükleme doğrulama testini yaz (başarısız olacak)**

`apps/web/lib/upload.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { PermanentError } from "@uyarla/core"
import { validateUpload } from "./upload.js"

const MB = 1024 * 1024

describe("validateUpload", () => {
  it("geçerli PDF'i kabul eder", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 2 * MB }, "ilan metni burada")).not.toThrow()
  })

  it("desteklenmeyen uzantıyı reddeder", () => {
    expect(() => validateUpload({ name: "cv.txt", size: 100 }, "ilan metni burada")).toThrow(
      PermanentError,
    )
  })

  it("çok büyük dosyayı reddeder", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 11 * MB }, "ilan metni burada")).toThrow(
      PermanentError,
    )
  })

  it("çok kısa ilan metnini reddeder", () => {
    expect(() => validateUpload({ name: "cv.pdf", size: 100 }, "kısa")).toThrow(PermanentError)
  })

  it("hata mesajı kullanıcıya gösterilebilir Türkçe olur", () => {
    try {
      validateUpload({ name: "cv.txt", size: 100 }, "ilan metni burada")
    } catch (error) {
      expect((error as PermanentError).message).toContain("PDF")
    }
  })
})
```

- [ ] **Adım 3: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/web test`
Beklenen: FAIL — `Cannot find module './upload.js'`

- [ ] **Adım 4: Doğrulamayı uygula**

`apps/web/lib/upload.ts`:

```ts
import { PermanentError } from "@uyarla/core"

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MIN_JOB_TEXT_LENGTH = 50
const ALLOWED_EXTENSIONS = ["pdf", "docx"]

export function validateUpload(
  file: { name: string; size: number },
  jobText: string,
): void {
  const ext = file.name.toLowerCase().split(".").pop() ?? ""
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new PermanentError(
      "Yalnızca PDF ve DOCX dosyalarını okuyabiliyoruz.",
      "unsupported_format",
    )
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new PermanentError(
      "Dosyan 10 MB'tan büyük. Daha küçük bir sürümünü yükler misin?",
      "file_too_large",
    )
  }

  if (jobText.trim().length < MIN_JOB_TEXT_LENGTH) {
    throw new PermanentError(
      "İlan metni çok kısa görünüyor. İlanın tamamını yapıştırır mısın?",
      "job_text_too_short",
    )
  }
}
```

- [ ] **Adım 5: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/web test`
Beklenen: PASS — 5 test geçti.

- [ ] **Adım 6: Kuyruk üretici tarafını yaz**

`apps/web/lib/queue.ts`:

```ts
import { Queue } from "bullmq"
import IORedis from "ioredis"
import { ANALYZE_QUEUE, type AnalyzeJobData } from "@uyarla/worker/queue"

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
})

export const analyzeQueue = new Queue<AnalyzeJobData, string>(ANALYZE_QUEUE, {
  connection,
})
```

- [ ] **Adım 7: İş oluşturma route'unu yaz**

`apps/web/app/api/analyze/route.ts`:

```ts
import { NextResponse } from "next/server"
import { LocalFileStore, PermanentError, extractText } from "@uyarla/core"
import { prisma } from "@uyarla/db"
import { ANALYZE_JOB_OPTIONS } from "@uyarla/worker/queue"
import { analyzeQueue } from "@/lib/queue"
import { validateUpload } from "@/lib/upload"

export const runtime = "nodejs"

/** Sprint 1'de kimlik yok; tek yerel test kullanıcısı (spec §5). */
const TEST_USER_EMAIL = "test@uyarla.local"

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("cv")
    const jobText = String(form.get("jobText") ?? "")

    if (!(file instanceof File)) {
      throw new PermanentError("CV dosyası bulunamadı.", "missing_file")
    }
    validateUpload({ name: file.name, size: file.size }, jobText)

    const buffer = Buffer.from(await file.arrayBuffer())
    const store = new LocalFileStore(process.env.STORAGE_DIR ?? "./storage")
    const filePath = await store.save(buffer, file.name)
    const rawText = await extractText(buffer, file.name)

    const user = await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      update: {},
      create: { email: TEST_USER_EMAIL },
    })

    const resume = await prisma.resume.create({
      data: { userId: user.id, filePath, rawText },
    })

    const posting = await prisma.jobPosting.create({
      data: { rawText: jobText, requirements: [], language: "tr" },
    })

    const job = await analyzeQueue.add(
      "analyze",
      { resumeId: resume.id, jobPostingId: posting.id },
      ANALYZE_JOB_OPTIONS,
    )

    return NextResponse.json({ jobId: job.id })
  } catch (error) {
    if (error instanceof PermanentError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      )
    }
    console.error("[api/analyze]", error)
    return NextResponse.json(
      { error: "Bir şeyler ters gitti. Birazdan tekrar dener misin?", code: "unknown" },
      { status: 500 },
    )
  }
}
```

- [ ] **Adım 8: Durum sorgulama route'unu yaz**

`apps/web/app/api/analyze/[id]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { prisma } from "@uyarla/db"
import { analyzeQueue } from "@/lib/queue"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const job = await analyzeQueue.getJob(id)

  if (!job) {
    return NextResponse.json({ error: "İş bulunamadı." }, { status: 404 })
  }

  const state = await job.getState()

  if (state === "completed") {
    const analysisId = job.returnvalue
    const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } })
    return NextResponse.json({
      status: "completed",
      score: analysis?.score ?? null,
      result: analysis?.result ?? null,
      durationMs: analysis?.durationMs ?? null,
      tokenUsage: analysis?.tokenUsage ?? null,
      modelId: analysis?.modelId ?? null,
    })
  }

  if (state === "failed") {
    return NextResponse.json({
      status: "failed",
      error: job.failedReason ?? "Analiz tamamlanamadı.",
    })
  }

  const progress = job.progress as { stage?: string } | number
  return NextResponse.json({
    status: "running",
    stage: typeof progress === "object" ? progress.stage : undefined,
  })
}
```

- [ ] **Adım 9: Kök layout'u ve stilleri yaz**

`apps/web/app/globals.css`:

```css
/* Sprint 1: markasız test arayüzü (K-01). Marka giydirmesi Sprint 2'de. */
body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 56rem; line-height: 1.5; }
textarea { width: 100%; }
.matched { color: #16a34a; }
.missing { color: #dc2626; }
details { margin-top: 2rem; }
pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; font-size: 0.8rem; }
ul { list-style: none; padding: 0; }
li { border-bottom: 1px solid #eee; padding: 0.5rem 0; }
.score { font-size: 3rem; font-weight: bold; }
.evidence { color: #64748b; font-size: 0.85rem; }
```

`apps/web/app/layout.tsx`:

```tsx
import "./globals.css"

export const metadata = { title: "Uyarla · Test" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Adım 10: Test arayüzünü yaz**

`apps/web/app/test/page.tsx`:

```tsx
"use client"

import { useState } from "react"

const STAGE_TEXT: Record<string, string> = {
  cv_okunuyor: "CV'ni okuyoruz…",
  ilan_okunuyor: "İlanı okuyoruz…",
  karsilastiriliyor: "İlanla karşılaştırıyoruz…",
  tamamlandi: "Hazır.",
}

interface RequirementResult {
  requirement: { text: string; importance: string; type: string }
  status: "matched" | "missing"
  confidence: number
  method: string | null
  evidence: { text: string } | null
}

interface AnalysisResponse {
  status: "running" | "completed" | "failed"
  stage?: string
  score?: number | null
  durationMs?: number | null
  tokenUsage?: number | null
  modelId?: string | null
  error?: string
  result?: {
    score: number
    requirements: RequirementResult[]
    missingKeywords: string[]
  } | null
}

export default function TestPage() {
  const [state, setState] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setState(null)
    setBusy(true)

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: new FormData(event.currentTarget),
    })
    const body = await response.json()

    if (!response.ok) {
      setError(body.error)
      setBusy(false)
      return
    }

    poll(body.jobId)
  }

  function poll(jobId: string) {
    const timer = setInterval(async () => {
      const response = await fetch(`/api/analyze/${jobId}`)
      const body: AnalysisResponse = await response.json()
      setState(body)

      if (body.status === "completed" || body.status === "failed") {
        clearInterval(timer)
        setBusy(false)
      }
    }, 1000)
  }

  return (
    <main>
      <h1>Uyarla · Sprint 1 test arayüzü</h1>

      <form onSubmit={onSubmit}>
        <p>
          <label>
            CV (PDF veya DOCX):{" "}
            <input type="file" name="cv" accept=".pdf,.docx" required />
          </label>
        </p>
        <p>
          <label>
            İlan metni:
            <textarea name="jobText" rows={12} required />
          </label>
        </p>
        <button type="submit" disabled={busy}>
          {busy ? "Çalışıyor…" : "Skoru hesapla"}
        </button>
      </form>

      {error && <p className="missing">{error}</p>}

      {state?.status === "running" && (
        <p>{STAGE_TEXT[state.stage ?? ""] ?? "Çalışıyor…"}</p>
      )}

      {state?.status === "failed" && <p className="missing">{state.error}</p>}

      {state?.status === "completed" && state.result && (
        <section>
          <p className="score">{state.result.score}</p>
          <p className="evidence">
            {state.durationMs} ms · {state.tokenUsage} token · {state.modelId}
          </p>

          <h2>Gereksinimler</h2>
          <ul>
            {state.result.requirements.map((item, i) => (
              <li key={i} className={item.status}>
                {item.status === "matched" ? "✓" : "✗"} {item.requirement.text}{" "}
                <span className="evidence">
                  ({item.requirement.importance}
                  {item.method ? ` · ${item.method} · ${item.confidence.toFixed(2)}` : ""})
                </span>
                {item.evidence && (
                  <div className="evidence">kanıt: {item.evidence.text}</div>
                )}
              </li>
            ))}
          </ul>

          <h2>Eksik anahtar kelimeler</h2>
          <p>{state.result.missingKeywords.join(", ") || "Yok"}</p>

          <details>
            <summary>Ham sonuç (K1 elle kontrolü için)</summary>
            <pre>{JSON.stringify(state.result, null, 2)}</pre>
          </details>
        </section>
      )}
    </main>
  )
}
```

- [ ] **Adım 11: Uçtan uca elle doğrula**

Üç terminal:

```bash
# 1
pnpm db:up
# 2
pnpm --filter @uyarla/worker start
# 3
pnpm --filter @uyarla/web dev
```

`http://localhost:3000/test` adresini aç. Bir CV yükle, bir ilan metni yapıştır,
"Skoru hesapla"ya bas.

Beklenen: aşama metinleri sırayla görünür, sonunda skor rakamı, gereksinim
listesi (kanıtlarıyla) ve eksik kelimeler gelir. Süre 30 saniyenin altında
olmalı (spec §13).

- [ ] **Adım 12: Commit**

```bash
pnpm --filter @uyarla/web test
git add apps/web apps/worker pnpm-lock.yaml
git commit -m "feat: analiz API route'ları ve markasız test arayüzü"
```

---

### Görev 13: Değerlendirme seti ve ölçüm betiği

Spec §10. K1 karar kapısının kanıtı bu betiğin çıktısıdır. Ölçülen şey skor
rakamı değil, **eşleştirme isabeti**.

**Dosyalar:**
- Oluştur: `packages/core/eval/types.ts`
- Oluştur: `packages/core/eval/run.ts`
- Oluştur: `packages/core/eval/pairs/01-frontend.json` … `10-*.json`
- Oluştur: `packages/core/eval/runs/.gitkeep`
- Test: `packages/core/eval/compare.test.ts`
- Oluştur: `packages/core/eval/compare.ts`
- Değiştir: `packages/core/package.json` (eval betiği)

**Arayüzler:**
- Tüketir: `extractResumeProfile`, `extractJobPosting`, `collectEvidence`,
  `score`, `LmStudioProvider`, `LmStudioEmbeddingProvider`.
- Üretir: `compareToExpectations(result, expectations): PairMetrics`

- [ ] **Adım 1: Beklenti tiplerini yaz**

`packages/core/eval/types.ts`:

```ts
export interface ExpectedRequirement {
  /** Gereksinimi tanımak için ilandaki metinden ayırt edici bir parça. */
  match: string
  /** Bu gereksinim CV'de karşılanmış sayılmalı mı? */
  shouldMatch: boolean
  /** Karşılanıyorsa kanıt olarak beklenen CV maddesinden ayırt edici bir parça. */
  evidenceContains?: string
}

export interface EvalPair {
  id: string
  note: string
  resumeText: string
  jobText: string
  expectations: ExpectedRequirement[]
}

export interface PairMetrics {
  id: string
  /** Doğru sınıflandırılan gereksinim sayısı. */
  hits: number
  /** CV'de kanıt var, sistem missing dedi. */
  misses: number
  /** CV'de kanıt yok, sistem matched dedi. Uydurma — en zararlısı. */
  fabrications: number
  /** Beklentide tanımlı ama ilan çıkarımında hiç üretilmemiş gereksinimler. */
  notExtracted: number
  score: number
  durationMs: number
}
```

- [ ] **Adım 2: Karşılaştırma testini yaz (başarısız olacak)**

`packages/core/eval/compare.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { compareToExpectations } from "./compare.js"
import type { ScoreResult } from "../src/score/score.js"

const result = (
  rows: Array<{ text: string; status: "matched" | "missing"; evidence?: string }>,
): ScoreResult => ({
  score: 50,
  missingKeywords: [],
  requirements: rows.map((row) => ({
    requirement: { text: row.text, type: "skill", importance: "must", keywords: [] },
    status: row.status,
    confidence: row.status === "matched" ? 1 : 0,
    method: row.status === "matched" ? "keyword" : null,
    evidence: row.evidence ? { text: row.evidence, kind: "bullet", sourceRef: null } : null,
  })),
})

describe("compareToExpectations", () => {
  it("doğru sınıflandırmayı isabet sayar", () => {
    const m = compareToExpectations(
      "p1",
      result([{ text: "React deneyimi", status: "matched", evidence: "React ile panel" }]),
      [{ match: "React", shouldMatch: true, evidenceContains: "React ile panel" }],
      1000,
    )
    expect(m.hits).toBe(1)
    expect(m.misses).toBe(0)
    expect(m.fabrications).toBe(0)
  })

  it("kanıtı olan gereksinimin missing denmesini kaçırma sayar", () => {
    const m = compareToExpectations(
      "p1",
      result([{ text: "React deneyimi", status: "missing" }]),
      [{ match: "React", shouldMatch: true }],
      1000,
    )
    expect(m.misses).toBe(1)
  })

  it("kanıtı olmayan gereksinimin matched denmesini uydurma sayar", () => {
    const m = compareToExpectations(
      "p1",
      result([{ text: "Kubernetes", status: "matched", evidence: "React ile panel" }]),
      [{ match: "Kubernetes", shouldMatch: false }],
      1000,
    )
    expect(m.fabrications).toBe(1)
  })

  it("yanlış kanıt gösterilmesini kaçırma sayar", () => {
    const m = compareToExpectations(
      "p1",
      result([{ text: "React deneyimi", status: "matched", evidence: "Muhasebe süreçleri" }]),
      [{ match: "React", shouldMatch: true, evidenceContains: "React ile panel" }],
      1000,
    )
    expect(m.hits).toBe(0)
    expect(m.misses).toBe(1)
  })

  it("ilan çıkarımının hiç üretmediği gereksinimi ayrı sayar", () => {
    const m = compareToExpectations("p1", result([]), [{ match: "React", shouldMatch: true }], 1000)
    expect(m.notExtracted).toBe(1)
    expect(m.hits).toBe(0)
  })
})
```

- [ ] **Adım 3: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/core exec vitest run eval/compare`
Beklenen: FAIL — `Cannot find module './compare.js'`

- [ ] **Adım 4: Karşılaştırmayı uygula**

`packages/core/eval/compare.ts`:

```ts
import type { ScoreResult } from "../src/score/score.js"
import { normalizeText } from "../src/normalize/turkish.js"
import type { ExpectedRequirement, PairMetrics } from "./types.js"

/**
 * Beklentileri sonuçla karşılaştırır. Skor rakamı karşılaştırılmaz —
 * ölçülen şey eşleştirme isabetidir (spec §10).
 */
export function compareToExpectations(
  id: string,
  result: ScoreResult,
  expectations: ExpectedRequirement[],
  durationMs: number,
): PairMetrics {
  let hits = 0
  let misses = 0
  let fabrications = 0
  let notExtracted = 0

  for (const expected of expectations) {
    const needle = normalizeText(expected.match)
    const actual = result.requirements.find((r) =>
      normalizeText(r.requirement.text).includes(needle),
    )

    if (!actual) {
      notExtracted++
      continue
    }

    const matched = actual.status === "matched"

    if (expected.shouldMatch && matched) {
      // Kanıt beklendiyse doğru maddeyi göstermiş olmalı.
      const evidenceOk =
        !expected.evidenceContains ||
        normalizeText(actual.evidence?.text ?? "").includes(
          normalizeText(expected.evidenceContains),
        )
      if (evidenceOk) hits++
      else misses++
    } else if (expected.shouldMatch && !matched) {
      misses++
    } else if (!expected.shouldMatch && matched) {
      fabrications++
    } else {
      hits++
    }
  }

  return { id, hits, misses, fabrications, notExtracted, score: result.score, durationMs }
}
```

- [ ] **Adım 5: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/core exec vitest run eval/compare`
Beklenen: PASS — 5 test geçti.

- [ ] **Adım 6: İlk çifti hazırla**

`packages/core/eval/pairs/01-frontend.json`:

```json
{
  "id": "01-frontend",
  "note": "Yeni mezun frontend adayı, React deneyimi var, Kubernetes yok. Kaynak: anonimleştirilmiş gerçek CV.",
  "resumeText": "Elif Y.\nFrontend Geliştirici\n\nHAKKIMDA\n3 yıldır React ile arayüz geliştiriyorum.\n\nDENEYİM\nAcme Teknoloji · Frontend Geliştirici · Ocak 2022 – halen\n- React ve TypeScript ile müşteri paneli geliştirdim\n- Sayfa yüklenme süresini %40 düşürdüm\n\nEĞİTİM\nBir Teknik Üniversite, Bilgisayar Mühendisliği, 2021\n\nBECERİLER\nReact, TypeScript, Next.js, Git",
  "jobText": "Frontend Geliştirici\n\nAradığımız nitelikler:\n- En az 3 yıl React deneyimi\n- TypeScript bilgisi şarttır\n- Git ile versiyon kontrolü deneyimi\n- Kubernetes ile konteyner yönetimi zorunludur\n\nTercihen:\n- Next.js deneyimi",
  "expectations": [
    { "match": "React", "shouldMatch": true, "evidenceContains": "React" },
    { "match": "TypeScript", "shouldMatch": true },
    { "match": "Git", "shouldMatch": true },
    { "match": "Kubernetes", "shouldMatch": false },
    { "match": "Next.js", "shouldMatch": true }
  ]
}
```

**Kalan 9 çift için KVKK kuralı (spec §10):** Gerçek CV'ler izinle alınır;
sete girmeden önce isim, telefon, e-posta ve adres çıkarılır. Okul ve şirket
isimleri gerekiyorsa genelleştirilir ("Bir Teknik Üniversite"). İlan metinleri
kamuya açık olduğu için olduğu gibi kullanılabilir.

Çeşitlilik hedefi — çiftler aynı meslekten olmasın:
yazılım (2), pazarlama (2), finans (1), satış (1), insan kaynakları (1),
mühendislik (1), yeni mezun deneyimsiz (1), kariyer değiştiren (1).

- [ ] **Adım 7: Ölçüm betiğini yaz**

`packages/core/eval/run.ts`:

```ts
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { LmStudioEmbeddingProvider, embeddingConfigFromEnv } from "../src/llm/embedding.js"
import { llmConfigFromEnv } from "../src/llm/types.js"
import { extractResumeProfile } from "../src/extract/resume.js"
import { extractJobPosting } from "../src/extract/job.js"
import { collectEvidence } from "../src/score/evidence.js"
import { score } from "../src/score/score.js"
import { DEFAULT_SCORING_CONFIG } from "../src/score/config.js"
import { compareToExpectations } from "./compare.js"
import type { EvalPair, PairMetrics } from "./types.js"

const PAIRS_DIR = join(import.meta.dirname, "pairs")
const RUNS_DIR = join(import.meta.dirname, "runs")

async function main() {
  const llmConfig = llmConfigFromEnv()
  const llm = new LmStudioProvider(llmConfig)
  const embedding = new LmStudioEmbeddingProvider(embeddingConfigFromEnv())

  const files = readdirSync(PAIRS_DIR).filter((f) => f.endsWith(".json")).sort()
  const metrics: PairMetrics[] = []

  for (const file of files) {
    const pair = JSON.parse(readFileSync(join(PAIRS_DIR, file), "utf8")) as EvalPair
    const startedAt = Date.now()

    try {
      const profile = await extractResumeProfile(llm, pair.resumeText)
      const posting = await extractJobPosting(llm, pair.jobText)

      const evidence = collectEvidence(profile.data)
      const evidenceTexts = evidence.map((e) => e.text)
      const requirementTexts = posting.data.requirements.map((r) => r.text)
      const vectors = await embedding.embed([...evidenceTexts, ...requirementTexts])

      const result = score({
        profile: profile.data,
        posting: posting.data,
        evidence,
        evidenceVectors: vectors.slice(0, evidenceTexts.length),
        requirementVectors: vectors.slice(evidenceTexts.length),
      })

      metrics.push(
        compareToExpectations(pair.id, result, pair.expectations, Date.now() - startedAt),
      )
    } catch (error) {
      console.error(`[eval] ${pair.id} başarısız:`, (error as Error).message)
      metrics.push({
        id: pair.id, hits: 0, misses: 0, fabrications: 0,
        notExtracted: pair.expectations.length, score: 0,
        durationMs: Date.now() - startedAt,
      })
    }
  }

  console.table(metrics)

  const totals = metrics.reduce(
    (acc, m) => ({
      hits: acc.hits + m.hits,
      misses: acc.misses + m.misses,
      fabrications: acc.fabrications + m.fabrications,
      notExtracted: acc.notExtracted + m.notExtracted,
    }),
    { hits: 0, misses: 0, fabrications: 0, notExtracted: 0 },
  )

  const checked = totals.hits + totals.misses + totals.fabrications
  const accuracy = checked === 0 ? 0 : totals.hits / checked
  const avgDuration = Math.round(
    metrics.reduce((sum, m) => sum + m.durationMs, 0) / (metrics.length || 1),
  )

  console.log("\n--- Toplam ---")
  console.log(`İsabet oranı   : ${(accuracy * 100).toFixed(1)}%`)
  console.log(`Kaçırma        : ${totals.misses}`)
  console.log(`Uydurma        : ${totals.fabrications}`)
  console.log(`Çıkarılmayan   : ${totals.notExtracted}`)
  console.log(`Ortalama süre  : ${avgDuration} ms`)
  console.log(`Model          : ${llmConfig.model}`)
  console.log(`Eşik / ağırlık : ${JSON.stringify(DEFAULT_SCORING_CONFIG)}`)

  mkdirSync(RUNS_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const outPath = join(RUNS_DIR, `${stamp}.json`)
  writeFileSync(
    outPath,
    JSON.stringify(
      { model: llmConfig.model, config: DEFAULT_SCORING_CONFIG, totals, accuracy, avgDuration, metrics },
      null,
      2,
    ),
  )
  console.log(`\nSonuç yazıldı: ${outPath}`)
}

void main()
```

- [ ] **Adım 8: Betiği kaydet**

`packages/core/package.json` içindeki `scripts` bölümüne ekle:

```json
"eval": "tsx eval/run.ts"
```

Ve `devDependencies`'e:

```bash
pnpm --filter @uyarla/core add -D tsx
```

`packages/core/eval/runs/.gitkeep` oluştur (boş dosya).

- [ ] **Adım 9: Eval'i çalıştır**

LM Studio ayakta olmalı.

Çalıştır: `pnpm --filter @uyarla/core eval`

Beklenen: her çift için bir satırlık tablo, ardından toplam isabet oranı,
kaçırma, uydurma, ortalama süre ve model adı; sonuç `eval/runs/` altına yazıldı.

- [ ] **Adım 10: Eşik ve ağırlıkları ayarla**

İlk çalıştırmanın sonuçlarına bak ve `DEFAULT_SCORING_CONFIG`'i ayarla:

- **Uydurma > 0 ise:** `semanticThreshold` değerini yükselt (0.70, 0.75 dene).
  Uydurma, kaçırmadan zararlıdır — önce bunu sıfıra indir.
- **Uydurma 0 ve kaçırma yüksekse:** eşiği düşür (0.60, 0.55 dene), veya
  kaçırılan kelimeleri `TITLE_SYNONYMS`'e ekle.
- **Çıkarılmayan yüksekse:** sorun skorda değil ilan çıkarımında;
  `JOB_PROMPT`'u düzelt.

Her ayarlamadan sonra eval'i tekrar çalıştır. `eval/runs/` altındaki iki
dosyayı karşılaştırarak ilerlemeyi gör. Yaptığın ayarlamaları ve gerekçelerini
`docs/kararlar.md`'ye K-09 olarak yaz.

- [ ] **Adım 11: Commit**

```bash
pnpm --filter @uyarla/core test
git add packages/core
git commit -m "feat: değerlendirme seti ve eşleştirme isabeti ölçüm betiği"
```

- [ ] **Adım 12: K1 karar kapısını değerlendir**

Spec §13'teki tamamlanma tanımını tek tek kontrol et:

```bash
pnpm test                                    # tüm birim testleri
pnpm --filter @uyarla/core test:integration  # gerçek modelle
pnpm --filter @uyarla/core eval              # eşleştirme isabeti
```

Ardından test arayüzünde 2–3 gerçek CV–ilan çiftini elle dene ve ham JSON
bloğuna bak: model CV'yi doğru okumuş mu, yoksa skor tesadüfen mi tutmuş?

K1 kararını (devam / düzelt ve tekrar dene / pivot) gerekçesiyle birlikte
`docs/kararlar.md`'ye yaz ve commit'le.

---

## Plan Öz Denetimi

Plan yazıldıktan sonra spec'e karşı kontrol edildi.

**Spec kapsamı:** §2 kapsam → Görev 1–13; §4.1 depo yapısı → Görev 1; §4.2
topoloji → Görev 1, 11, 12; §5 veri modeli → Görev 2 (+ Görev 11 Adım 1
düzeltmesi); §6.1 sağlayıcı → Görev 4, 9; §6.2 şemalar → Görev 5; §6.3 iki
aşamalı çıkarım → Görev 6; §7 skor → Görev 8, 10; §8 kuyruk → Görev 11;
§9 test arayüzü → Görev 12; §10 eval → Görev 13; §11 hata yönetimi → Görev 3
(dosya), 4 (LLM), 9 (embedding), 11 (sınıflandırma ve kayıt), 12 (kullanıcı
mesajları); §12 test stratejisi → her görevin birim testleri, Görev 6/7/9
tümleşik testleri; §13 tamamlanma tanımı → Görev 13 Adım 12.

**Spec'ten iki sapma, ikisi de kayda geçti:**

1. `LlmProvider.extract` dönüş tipi `Promise<T>` değil `Promise<ExtractResult<T>>`
   — `Analysis.tokenUsage` alanı için token sayısı gerekiyor (Görev 4 başında
   açıklandı).
2. `Analysis.resumeVersionId` nullable tanımlandı — CV çıkarımı başarısız
   olduğunda `ResumeVersion` oluşmaz ama spec §11 yine de Analysis kaydı ister.
   Spec §5'teki tablo alanı zorunlu gösteriyordu; şema Görev 2'de baştan
   nullable yazılıyor ki tek migration yetsin.

**Tip tutarlılığı:** `ExtractResult`/`LlmProvider` (Görev 4) → Görev 6, 7, 11'de
aynı imzayla; `Evidence`/`collectEvidence` (Görev 10) → Görev 11, 13'te;
`ScoreResult`/`RequirementResult` (Görev 10) → Görev 12 arayüzü ve Görev 13
karşılaştırmasında; `ANALYZE_QUEUE`/`AnalyzeJobData` (Görev 11) → Görev 12'de;
`containsKeyword` (Görev 8) ve `cosineSimilarity` (Görev 9) → Görev 10'da.

**Kapsam dışı bırakılan ve bilinçli:** Görev 13'te 10 çiftin yalnızca birincisi
hazır veri olarak veriliyor; kalan dokuzu gerçek ve izinli veri gerektirdiği
için plan onların içeriğini uyduramaz — biçim, KVKK kuralı ve çeşitlilik hedefi
verildi.
