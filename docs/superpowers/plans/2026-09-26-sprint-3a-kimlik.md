# Sprint 3A — Kimlik, Huni ve Sahiplik · Implementasyon Planı

> **Ajan çalışanlar için:** GEREKLİ ALT-SKILL: Bu planı görev görev uygulamak
> için `superpowers:subagent-driven-development` (önerilen) veya
> `superpowers:executing-plans` kullanın. Adımlar takip için checkbox
> (`- [ ]`) sözdizimi kullanır.

**Hedef:** Ürüne kimlik kazandırmak ve her kaynağı sahibine bağlamak — ödeme
tasarımını beklemeden.

**Mimari:** Better Auth `apps/web` katmanında yapılandırılır; `packages/core`
framework'süz kalır. Kayıtsız ziyaretçi anonim oturumla skor alır, kayıt
olunca işi devralınır. Yetki kontrolü tek bir yardımcıdan geçer ve yetkisiz
erişimde 404 döner.

**Teknoloji:** Mevcut yığın (TypeScript, Next.js 15, Prisma, Redis, Vitest) +
`better-auth` 1.7.x + `resend`.

**Spec:** `docs/superpowers/specs/2026-09-26-sprint-3a-kimlik-design.md`

## Genel Kısıtlar

Bu bölüm her görevin gereksinimlerine örtük olarak dahildir.

- **Sprint 1–2'nin tüm kısıtları geçerli:** pnpm çalışma alanı, TypeScript
  `strict`, Vitest, `packages/core` framework'süz ve Prisma'sız, `any` yok.
- **Kimlik `packages/core`'a sızmaz.** Alan mantığı oturumu bilmez; kimlik
  HTTP katmanının işidir.
- **Worker kimlik bilmez.** Kuyruğa yalnızca kayıt kimlikleri girer; yetki
  kontrolü işi kuyruğa koyan route'ta yapılır.
- **Yetkisiz erişimde 404, 403 değil.** 403 kaynağın var olduğunu sızdırır.
- **Şema elle yazılmaz**, `npx @better-auth/cli generate` ile üretilir.
  Çelişki çıkarsa CLI'ın ürettiği doğrudur.
- **Kullanıcıya görünen tüm metinler Türkçe**, marka rehberi §6 tonunda:
  "sen" diliyle, kısa cümle, önce sonuç, suçlamayan hata mesajı.
- **Testler ve kod yorumları Türkçe.** Kod tabanının dili bu.
- **Vitest yalnızca `lib/**/*.test.ts` tarıyor** (`apps/web/vitest.config.ts`).
  Test edilebilir mantık `lib/` altına konur; `app/` altına yazılan test
  sessizce hiç çalışmaz — Sprint 2'de bu bir kez yaşandı.
- **Her görev testle biter ve commit'lenir.** Commit mesajları Türkçe,
  `feat:` / `fix:` / `test:` / `chore:` önekiyle.

---

## Dosya Yapısı

### `apps/web/lib` — test edilebilir mantık

| Dosya | Sorumluluk |
|---|---|
| `auth.ts` | Better Auth sunucu yapılandırması; eklentiler, e-posta, devralma |
| `authClient.ts` | İstemci tarafı (React bileşenleri bunu kullanır) |
| `authz.ts` | Yetkilendirme: saf kurallar + oturum okuyan ince kabuk |
| `rateLimit.ts` | Sabit pencereli sayaç; depolama arayüzden geçer |
| `redis.ts` | Paylaşılan Redis bağlantısı (hâlen `lib/queue.ts` içinde gömülü) |
| `mail.ts` | Magic link e-postası; Resend yoksa konsola düşer |
| `devral.ts` | Anonim kullanıcının işini yeni hesaba taşıyan işlemler |

### `apps/web/app` — HTTP ve arayüz

| Dosya | Sorumluluk |
|---|---|
| `api/auth/[...all]/route.ts` | Better Auth'un uçları |
| `api/analyze/route.ts` | Anonim oturum açma + hız limiti + sahiplik yazma |
| `api/analyze/[id]/route.ts` | Sahiplik kontrolü |
| `api/adapt/route.ts` | Kayıtlı olma + sahiplik + hız limiti |
| `api/adapt/[id]/*` | Sahiplik kontrolü |
| `giris/page.tsx` | Magic link giriş ekranı |
| `components/OturumCubugu.tsx` | Kim giriş yapmış, çıkış bağlantısı |

### `packages/db`

| Dosya | Sorumluluk |
|---|---|
| `prisma/schema.prisma` | Better Auth modelleri + `Analysis.userId`, `JobPosting.userId` |

---

## Görev Sırası

Doğrusal: her görev bir öncekinin kurduğu yüzeye dayanıyor.

| # | Görev | Spec | Süre |
|---|---|---|---|
| 1 | Şema, sahiplik alanları ve göç | §5 | 3 sa |
| 2 | Kimlik katmanı, magic link, e-posta | §6 | 4 sa |
| 3 | Yetkilendirme yardımcısı | §8 | 3 sa |
| 4 | Route'lara yetki kontrolü | §8 | 2 sa |
| 5 | Anonim oturum ve devralma | §7 | 3 sa |
| 6 | Hız limiti | §9 | 2 sa |
| 7 | Giriş ekranı ve oturum çubuğu | §2 | 3 sa |
| | | **Toplam** | **20 sa** |

---

### Görev 1: Şema, sahiplik alanları ve göç

Spec §5. Better Auth'un dört modeli + iki sahiplik alanı. Geliştirme verisi
siliniyor.

**Dosyalar:**
- Değiştir: `packages/db/prisma/schema.prisma`
- Değiştir: `apps/web/package.json` (`better-auth`)
- Oluştur: `apps/web/lib/auth.ts` (CLI'ın okuyacağı asgari yapılandırma)
- Değiştir: `.env.example`

**Arayüzler:**
- Üretir: Prisma modelleri `User` (genişletilmiş), `Session`, `Account`,
  `Verification`; `Analysis.userId`, `JobPosting.userId`
- Görev 2–7 bu şemaya dayanır.

- [ ] **Adım 1: Bağımlılıkları kur**

```bash
pnpm --filter @uyarla/web add better-auth
pnpm --filter @uyarla/web add -D @better-auth/cli
```

- [ ] **Adım 2: CLI'ın okuyabileceği asgari yapılandırmayı yaz**

CLI, şemayı üretebilmek için hangi eklentilerin etkin olduğunu bilmek
zorunda. Tam yapılandırma Görev 2'de; burada yalnızca eklenti listesi
doğru olmalı.

`apps/web/lib/auth.ts`:

```ts
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { anonymous, magicLink } from "better-auth/plugins"
import { prisma } from "@uyarla/db"

/**
 * Kimlik katmanı. `packages/core` bunu bilmiyor ve bilmemeli: kimlik HTTP
 * katmanının işi, alan mantığı oturumdan bağımsız kalıyor.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  plugins: [
    magicLink({
      // Gerçek gönderim Görev 2'de; CLI'ın şema üretmesi için eklentinin
      // etkin olması yeterli.
      sendMagicLink: async () => {},
    }),
    anonymous(),
  ],
})
```

- [ ] **Adım 3: Şemayı üret**

```bash
cd apps/web && pnpm exec @better-auth/cli generate \
  --config lib/auth.ts \
  --output ../../packages/db/prisma/schema.prisma
```

CLI mevcut şemaya ekleme yapmayı teklif eder; kabul et. Sonra çıktıyı oku:

```bash
git diff packages/db/prisma/schema.prisma
```

Beklenen: `Session`, `Account`, `Verification` modelleri eklendi; `User`'a
`name`, `emailVerified`, `image`, `updatedAt`, `isAnonymous` alanları geldi.

**CLI çıktısı bu belgedeki tahminle çelişirse CLI doğrudur.** Farkı not et,
Görev 1 sonunda spec'i güncelle.

- [ ] **Adım 4: Sahiplik alanlarını elle ekle**

CLI bunları üretmez; bizim alan modelimiz.

`packages/db/prisma/schema.prisma` içinde `Analysis` modeline:

```prisma
  // Sahiplik zincirden türetilemiyor: resumeVersionId nullable ve çıkarım
  // patlayan analizler ResumeVersion üretmiyor, sahipsiz kalırlardı.
  userId String
  user   User   @relation(fields: [userId], references: [id])
```

ve aynı modelin sonuna:

```prisma
  @@index([userId])
```

`JobPosting` modeline:

```prisma
  // Kullanıcının yapıştırdığı metni tutuyor ve marka rehberi "istediğin an
  // silebilirsin" diyor; sahipsiz satır o sözü tutulamaz kılar.
  userId String
  user   User   @relation(fields: [userId], references: [id])
```

ve sonuna:

```prisma
  @@index([userId])
```

`User` modeline ters ilişkiler:

```prisma
  analyses    Analysis[]
  jobPostings JobPosting[]
```

- [ ] **Adım 5: Geliştirme verisini sil ve göçü çalıştır**

`User.name` zorunlu ve mevcut tek kullanıcı adsız; ona bağlı tüm veri Sprint
1–2 test artığı (spec §5).

```bash
docker compose exec -T postgres psql -U uyarla -d uyarla -c \
 'TRUNCATE "Adaptation","Analysis","ResumeVersion","Resume","JobPosting","User" CASCADE;'
pnpm --filter @uyarla/db migrate --name sprint3a_kimlik
```

Beklenen: "Your database is now in sync with your schema."

- [ ] **Adım 6: Ortam değişkenlerini belgele**

`.env.example` sonuna ekle (değer YAZMA — GitGuardian tarar):

```
# Kimlik doğrulama
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
# E-posta (boşsa magic link terminale yazılır)
RESEND_API_KEY=
EMAIL_FROM=
```

Yerel `.env`'ye gerçek değerleri koy:

```bash
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "BETTER_AUTH_URL=http://localhost:3000" >> .env
```

- [ ] **Adım 7: Doğrula ve commit**

```bash
pnpm --filter @uyarla/db migrate:status
pnpm -r typecheck
git add packages/db apps/web .env.example pnpm-lock.yaml
git commit -m "feat: kimlik şeması, sahiplik alanları ve göç"
```

Beklenen: migrate:status "Database schema is up to date", typecheck temiz.

---

### Görev 2: Kimlik katmanı, magic link ve e-posta

Spec §6. Tek giriş yöntemi magic link. Resend yoksa bağlantı terminale
düşüyor — hesap açmadan geliştirme yapılabilsin diye.

**Dosyalar:**
- Oluştur: `apps/web/lib/mail.ts`
- Test: `apps/web/lib/mail.test.ts`
- Değiştir: `apps/web/lib/auth.ts`
- Oluştur: `apps/web/lib/authClient.ts`
- Oluştur: `apps/web/app/api/auth/[...all]/route.ts`
- Değiştir: `apps/web/package.json` (`resend`)

**Arayüzler:**
- Tüketir: Görev 1'in şeması.
- Üretir:
  - `sendMagicLinkEmail(input: { email: string; url: string }): Promise<void>`
  - `auth` (tam yapılandırma), `authClient` (istemci)
  - `GET`/`POST` `/api/auth/*`
- Görev 3, 5, 7 bunları kullanır.

- [ ] **Adım 1: Resend'i kur**

```bash
pnpm --filter @uyarla/web add resend
```

- [ ] **Adım 2: E-posta testini yaz**

`apps/web/lib/mail.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { sendMagicLinkEmail } from "./mail"

const ORIJINAL = { ...process.env }

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  process.env = { ...ORIJINAL }
})

describe("sendMagicLinkEmail", () => {
  it("RESEND_API_KEY yoksa bağlantıyı konsola yazar, hata fırlatmaz", async () => {
    // Hesap açmadan geliştirme yapılabilmesi bilinçli bir karar (spec §6).
    delete process.env.RESEND_API_KEY
    const log = vi.spyOn(console, "info").mockImplementation(() => {})

    await sendMagicLinkEmail({ email: "aday@ornek.com", url: "https://x/y?token=abc" })

    expect(log).toHaveBeenCalled()
    expect(log.mock.calls.flat().join(" ")).toContain("https://x/y?token=abc")
  })

  it("konsol modunda e-posta adresini de yazar", async () => {
    delete process.env.RESEND_API_KEY
    const log = vi.spyOn(console, "info").mockImplementation(() => {})
    await sendMagicLinkEmail({ email: "aday@ornek.com", url: "https://x" })
    expect(log.mock.calls.flat().join(" ")).toContain("aday@ornek.com")
  })

  it("anahtar varsa Resend'e gönderir", async () => {
    process.env.RESEND_API_KEY = "re_test"
    process.env.EMAIL_FROM = "Uyarla <merhaba@uyarla.app>"
    const send = vi.fn().mockResolvedValue({ data: { id: "1" }, error: null })

    await sendMagicLinkEmail(
      { email: "aday@ornek.com", url: "https://x/y" },
      { emails: { send } },
    )

    expect(send).toHaveBeenCalledOnce()
    const cagri = send.mock.calls[0]![0]
    expect(cagri.to).toBe("aday@ornek.com")
    expect(cagri.from).toBe("Uyarla <merhaba@uyarla.app>")
    expect(cagri.html).toContain("https://x/y")
  })

  it("Resend hata dönerse fırlatır", async () => {
    // Sessizce yutmak, kullanıcıyı gelmeyecek bir e-postayı beklemeye iter.
    process.env.RESEND_API_KEY = "re_test"
    const send = vi.fn().mockResolvedValue({ data: null, error: { message: "quota" } })

    await expect(
      sendMagicLinkEmail({ email: "a@b.c", url: "https://x" }, { emails: { send } }),
    ).rejects.toThrow(/quota/)
  })

  it("e-posta metni Türkçe ve marka tonunda", async () => {
    process.env.RESEND_API_KEY = "re_test"
    const send = vi.fn().mockResolvedValue({ data: { id: "1" }, error: null })
    await sendMagicLinkEmail({ email: "a@b.c", url: "https://x" }, { emails: { send } })

    const cagri = send.mock.calls[0]![0]
    expect(cagri.subject).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
    expect(cagri.html).not.toMatch(/click here|sign in/i)
  })
})
```

- [ ] **Adım 3: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/web test lib/mail`
Beklenen: FAIL — `Cannot find module './mail'`

- [ ] **Adım 4: E-posta gönderimini yaz**

`apps/web/lib/mail.ts`:

```ts
import { Resend } from "resend"

/** Test edilebilirlik için daraltılmış istemci yüzeyi. */
export interface MailClient {
  emails: {
    send(args: {
      from: string
      to: string
      subject: string
      html: string
    }): Promise<{ data: unknown; error: { message: string } | null }>
  }
}

const KONU = "Uyarla'ya giriş bağlantın"

function govde(url: string): string {
  // Sade HTML: e-posta istemcilerinin çoğu CSS'i kırpıyor ve bağlantının
  // her yerde tıklanabilir kalması gönderinin tek işi.
  return `
    <p>Merhaba,</p>
    <p>Aşağıdaki bağlantıya tıklayarak Uyarla'ya girebilirsin:</p>
    <p><a href="${url}">Uyarla'ya gir</a></p>
    <p>Bağlantı 15 dakika geçerli ve tek kullanımlık.</p>
    <p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
  `
}

/**
 * Magic link e-postasını gönderir.
 *
 * `RESEND_API_KEY` tanımlı değilse bağlantı terminale yazılıyor ve e-posta
 * gönderilmiyor. Bu bir hata durumu değil, bilinçli bir geliştirme modu
 * (spec §6): kimse hesap açmadan da giriş akışını deneyebilmeli.
 */
export async function sendMagicLinkEmail(
  input: { email: string; url: string },
  client?: MailClient,
): Promise<void> {
  const anahtar = process.env.RESEND_API_KEY

  if (!anahtar && !client) {
    console.info(
      `\n[kimlik] E-posta gönderilmedi (RESEND_API_KEY yok).\n` +
        `  alıcı : ${input.email}\n` +
        `  bağlantı: ${input.url}\n`,
    )
    return
  }

  const mail = client ?? (new Resend(anahtar) as unknown as MailClient)
  const { error } = await mail.emails.send({
    from: process.env.EMAIL_FROM ?? "Uyarla <onboarding@resend.dev>",
    to: input.email,
    subject: KONU,
    html: govde(input.url),
  })

  // Sessizce yutmak, kullanıcıyı gelmeyecek bir e-postayı beklemeye iter.
  if (error) throw new Error(`E-posta gönderilemedi: ${error.message}`)
}
```

- [ ] **Adım 5: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/web test lib/mail`
Beklenen: PASS — 5 test geçti.

- [ ] **Adım 6: Kimlik yapılandırmasını tamamla**

`apps/web/lib/auth.ts` dosyasını tümüyle değiştir:

```ts
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { anonymous, magicLink } from "better-auth/plugins"
import { prisma } from "@uyarla/db"
import { sendMagicLinkEmail } from "./mail"

/**
 * Kimlik katmanı. `packages/core` bunu bilmiyor ve bilmemeli: kimlik HTTP
 * katmanının işi, alan mantığı oturumdan bağımsız kalıyor.
 *
 * Tek giriş yöntemi magic link (spec §6). Parola yok: unutulacak bir şey
 * yok, sızacak bir şey yok, ve tek seferlik CV uyarlaması için parola
 * kurmak gereksiz sürtünme.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // Kimlik uçlarının kendi limiti (spec §9). Bir e-posta adresine bağlantı
  // yağmuru yapılmasını engelliyor.
  rateLimit: { enabled: true, window: 60, max: 3 },

  // Google buraya gelecek. Kimlik bilgileri .env'ye eklendiğinde açılıyor;
  // şimdilik boş (spec §6).
  socialProviders: {},

  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 dakika
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ email, url })
      },
    }),
    // Devralma mantığı Görev 5'te bu eklentiye takılacak.
    anonymous(),
  ],
})
```

- [ ] **Adım 7: Route handler ve istemciyi yaz**

`apps/web/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth"

export const runtime = "nodejs"

export const { GET, POST } = toNextJsHandler(auth)
```

`apps/web/lib/authClient.ts`:

```ts
import { createAuthClient } from "better-auth/react"
import { anonymousClient, magicLinkClient } from "better-auth/client/plugins"

/** İstemci tarafı kimlik. React bileşenleri bunu kullanıyor. */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), anonymousClient()],
})

export const { signIn, signOut, useSession } = authClient
```

- [ ] **Adım 8: Ucun ayakta olduğunu doğrula**

Web'i başlat ve magic link iste:

```bash
curl -s -X POST localhost:3000/api/auth/sign-in/magic-link \
  -H 'content-type: application/json' \
  -d '{"email":"aday@ornek.com"}' -w "\nHTTP %{http_code}\n"
```

Beklenen: HTTP 200, ve web terminalinde `[kimlik] E-posta gönderilmedi`
satırıyla birlikte bağlantı. Bağlantıyı tarayıcıda aç — giriş olmalı.

- [ ] **Adım 9: Testleri çalıştır ve commit**

```bash
pnpm --filter @uyarla/web test
pnpm --filter @uyarla/web typecheck
pnpm --filter @uyarla/web build
git add apps/web pnpm-lock.yaml
git commit -m "feat: magic link ile giriş ve e-posta gönderimi"
```

---

### Görev 3: Yetkilendirme yardımcısı

Spec §8. Kurallar saf ve test edilebilir; oturum okuyan kabuk ince.

**Dosyalar:**
- Oluştur: `apps/web/lib/authz.ts`
- Test: `apps/web/lib/authz.test.ts`

**Arayüzler:**
- Tüketir: Görev 2'den `auth`.
- Üretir:
  - `class AuthError extends Error { status: number; code: string }`
  - `Oturum = { user: { id: string; isAnonymous: boolean } }`
  - `ensureSession(session: Oturum | null): Oturum`
  - `ensureRegistered(session: Oturum | null): Oturum`
  - `ensureOwner(ownerId: string | null, session: Oturum | null): Oturum`
  - `getSession(): Promise<Oturum | null>` (başlıkları okur)
  - `authErrorResponse(error: unknown): NextResponse | null`
- Görev 4, 5, 6, 7 bunları kullanır.

- [ ] **Adım 1: Testi yaz**

`apps/web/lib/authz.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { AuthError, ensureOwner, ensureRegistered, ensureSession } from "./authz"

const kayitli = { user: { id: "u1", isAnonymous: false } }
const anonim = { user: { id: "a1", isAnonymous: true } }

describe("ensureSession", () => {
  it("oturum varsa döndürür", () => {
    expect(ensureSession(kayitli)).toBe(kayitli)
  })

  it("anonim oturumu da kabul eder", () => {
    // Skor almak için kayıt gerekmiyor (spec §7).
    expect(ensureSession(anonim)).toBe(anonim)
  })

  it("oturum yoksa 401 fırlatır", () => {
    expect(() => ensureSession(null)).toThrow(AuthError)
    try {
      ensureSession(null)
    } catch (e) {
      expect((e as AuthError).status).toBe(401)
      expect((e as AuthError).message).toMatch(/giriş/i)
    }
  })
})

describe("ensureRegistered", () => {
  it("kayıtlı oturumu geçirir", () => {
    expect(ensureRegistered(kayitli)).toBe(kayitli)
  })

  it("anonim oturumda 401 ve kayıt çağrısı döner", () => {
    // Uyarlama kayıt gerektiriyor (spec §8).
    try {
      ensureRegistered(anonim)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect((e as AuthError).status).toBe(401)
      expect((e as AuthError).code).toBe("kayit_gerekli")
      expect((e as AuthError).message).toMatch(/e-posta/i)
    }
  })

  it("oturum yoksa 401 fırlatır", () => {
    expect(() => ensureRegistered(null)).toThrow(AuthError)
  })
})

describe("ensureOwner", () => {
  it("sahip oturumu geçirir", () => {
    expect(ensureOwner("u1", kayitli)).toBe(kayitli)
  })

  it("başkasının kaynağında 404 döner, 403 değil", () => {
    // 403 kaynağın var olduğunu sızdırır (spec §8).
    try {
      ensureOwner("baskasi", kayitli)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect((e as AuthError).status).toBe(404)
      expect((e as AuthError).message).toBe("Bulunamadı.")
    }
  })

  it("sahipsiz kaynakta 404 döner", () => {
    // Sahipsiz satır bir hata durumu; kimseye açılmamalı.
    expect(() => ensureOwner(null, kayitli)).toThrow(AuthError)
  })

  it("oturum yoksa 401 fırlatır", () => {
    // Sahiplik karşılaştırmasından önce oturum gerekiyor; aksi hâlde
    // null === null gibi bir kaza sahipsiz kaynağı herkese açardı.
    try {
      ensureOwner(null, null)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect((e as AuthError).status).toBe(401)
    }
  })

  it("anonim sahip kendi kaynağına erişebilir", () => {
    // Kayıtsız kullanıcı kendi skorunu görebilmeli (spec §7).
    expect(ensureOwner("a1", anonim)).toBe(anonim)
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/web test lib/authz`
Beklenen: FAIL — `Cannot find module './authz'`

- [ ] **Adım 3: Uygula**

`apps/web/lib/authz.ts`:

```ts
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "./auth"

export interface Oturum {
  user: { id: string; isAnonymous: boolean }
}

/** HTTP durumunu ve makine okunur kodu taşıyan yetki hatası. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = "AuthError"
  }
}

/** Oturum şart; anonim yeterli. */
export function ensureSession(session: Oturum | null): Oturum {
  // Mesajlar spec §10'daki tablodan; marka rehberi §6 tonunda.
  if (!session) {
    throw new AuthError("Devam etmek için giriş yapman gerekiyor.", 401, "oturum_yok")
  }
  return session
}

/** Kayıtlı oturum şart; anonim yetmez. */
export function ensureRegistered(session: Oturum | null): Oturum {
  const oturum = ensureSession(session)
  if (oturum.user.isAnonymous) {
    throw new AuthError(
      "CV'ni uyarlamak için e-postanı bırakman yeterli.",
      401,
      "kayit_gerekli",
    )
  }
  return oturum
}

/**
 * Kaynağın sahibi oturum sahibi mi.
 *
 * Uymuyorsa 404 dönüyor, 403 değil: 403 kaynağın var olduğunu sızdırır
 * (spec §8). Sahipsiz kaynak da 404 — sahipsiz satır bir hata durumu ve
 * kimseye açılmamalı.
 */
export function ensureOwner(ownerId: string | null, session: Oturum | null): Oturum {
  const oturum = ensureSession(session)
  if (!ownerId || ownerId !== oturum.user.id) {
    throw new AuthError("Bulunamadı.", 404, "bulunamadi")
  }
  return oturum
}

/** İstek başlıklarından oturumu okur. */
export async function getSession(): Promise<Oturum | null> {
  const sonuc = await auth.api.getSession({ headers: await headers() })
  if (!sonuc?.user) return null
  return {
    user: {
      id: sonuc.user.id,
      // anonymous eklentisi bu alanı ekliyor; yoksa kayıtlı sayılıyor.
      isAnonymous: (sonuc.user as { isAnonymous?: boolean }).isAnonymous ?? false,
    },
  }
}

/**
 * AuthError'ı HTTP yanıtına çevirir; başka hata türlerinde null döner.
 *
 * Route'ların catch bloğunda tek satırla kullanılıyor, böylece her uçta
 * aynı durum kodu ve aynı dil çıkıyor.
 */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof AuthError)) return null
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/web test lib/authz`
Beklenen: PASS — 11 test geçti.

- [ ] **Adım 5: Commit**

```bash
pnpm --filter @uyarla/web test
pnpm --filter @uyarla/web typecheck
git add apps/web
git commit -m "feat: yetkilendirme yardımcısı — yetkisiz erişimde 404"
```

---

### Görev 4: Route'lara yetki kontrolü

Spec §8. Altı uç korunuyor. Bu görevden sonra kimse başkasının CV'sine
erişemiyor.

**Dosyalar:**
- Değiştir: `apps/web/app/api/analyze/route.ts`
- Değiştir: `apps/web/app/api/analyze/[id]/route.ts`
- Değiştir: `apps/web/app/api/adapt/route.ts`
- Değiştir: `apps/web/app/api/adapt/[id]/route.ts`
- Değiştir: `apps/web/app/api/adapt/[id]/decision/route.ts`
- Değiştir: `apps/web/app/api/adapt/[id]/download/route.ts`
- Değiştir: `apps/web/lib/adaptation.ts` (`loadAdaptation` sahibi döndürsün)

**Arayüzler:**
- Tüketir: Görev 3'ten `getSession`, `ensureOwner`, `ensureRegistered`,
  `authErrorResponse`.
- Üretir: `loadAdaptation` dönüşüne `ownerId: string | null` eklenir.
- Görev 5 bu route'ların üstüne anonim oturum açmayı ekler.

- [ ] **Adım 1: `loadAdaptation` sahibi döndürsün**

`apps/web/lib/adaptation.ts` içindeki `loadAdaptation` dönüş nesnesine ekle:

```ts
    /** Yetki kontrolü için; Adaptation'ın kendi userId'si yok (spec §5). */
    ownerId: analysis.userId,
```

- [ ] **Adım 2: Analiz durumu ucunu koru**

`apps/web/app/api/analyze/[id]/route.ts` — `GET` gövdesini sarmala:

```ts
import { prisma } from "@uyarla/db"
import { NextResponse } from "next/server"
import { analyzeQueue } from "@/lib/queue"
import { authErrorResponse, ensureOwner, getSession } from "@/lib/authz"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const job = await analyzeQueue.getJob(id)
    if (!job) return NextResponse.json({ error: "İş bulunamadı." }, { status: 404 })

    const state = await job.getState()

    if (state === "completed") {
      const analysisId = job.returnvalue
      const analysis = analysisId
        ? await prisma.analysis.findUnique({ where: { id: analysisId } })
        : null

      // Sahiplik analiz kaydında; iş kimliği kuyrukta ve tahmin edilebilir.
      ensureOwner(analysis?.userId ?? null, await getSession())

      return NextResponse.json({
        status: "completed",
        analysisId: analysisId ?? null,
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
  } catch (error) {
    const yanit = authErrorResponse(error)
    if (yanit) return yanit
    console.error("[api/analyze/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
```

Not: iş kimliği BullMQ'da artan tam sayı, yani tahmin edilebilir. Sahiplik
kontrolü olmadan bir kullanıcı `/api/analyze/7` deyip başkasının skorunu
görebilirdi.

- [ ] **Adım 3: Uyarlama başlatmayı koru**

`apps/web/app/api/adapt/route.ts` içinde, analiz bulunduktan hemen sonra:

```ts
    // Uyarlama kayıt gerektiriyor (spec §8); analiz de bu kullanıcının olmalı.
    // Oturum değişkende tutuluyor: Görev 6 hız limiti anahtarı için kullanacak.
    const oturum = ensureOwner(analysis.userId, ensureRegistered(await getSession()))
```

import satırını ekle:

```ts
import { authErrorResponse, ensureOwner, ensureRegistered, getSession } from "@/lib/authz"
```

ve `catch` bloğunun başına:

```ts
    const yetkiYaniti = authErrorResponse(error)
    if (yetkiYaniti) return yetkiYaniti
```

- [ ] **Adım 4: Uyarlama okuma, karar ve indirme uçlarını koru**

Üç dosyada da aynı desen. `apps/web/app/api/adapt/[id]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { authErrorResponse, ensureOwner, getSession } from "@/lib/authz"
import { computeScoreAfter, loadAdaptation } from "@/lib/adaptation"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  try {
    const yuk = await loadAdaptation(id)
    if (!yuk) return NextResponse.json({ error: "Uyarlama bulunamadı." }, { status: 404 })

    ensureOwner(yuk.ownerId, await getSession())

    const { adaptation, profile, posting, draft, scoreBefore } = yuk
    return NextResponse.json({
      status: adaptation.status,
      draft,
      scoreBefore,
      scoreAfter: await computeScoreAfter(profile, posting, draft),
      errorClass: adaptation.errorClass,
    })
  } catch (error) {
    const yanit = authErrorResponse(error)
    if (yanit) return yanit
    console.error("[api/adapt/[id]]", error)
    return NextResponse.json({ error: "Bir şeyler ters gitti." }, { status: 500 })
  }
}
```

`decision/route.ts` ve `download/route.ts` içinde de `loadAdaptation`
çağrısından hemen sonra aynı satırı ekle:

```ts
  ensureOwner(yuk.ownerId, await getSession())
```

ve her ikisinde gövdeyi `try`/`catch` ile sarıp `catch` içinde:

```ts
    const yanit = authErrorResponse(error)
    if (yanit) return yanit
```

- [ ] **Adım 5: Elle doğrula — sızıntı testi**

İki farklı tarayıcı profili (ya da `curl` ile iki ayrı çerez kavanozu) ile:

```bash
# 1. kullanıcı: giriş yap, analiz çalıştır, uyarlama oluştur → ID'yi not et
# 2. kullanıcı: farklı e-postayla giriş yap, 1. kullanıcının ID'siyle dene
curl -s -b kavanoz2.txt -o /dev/null -w "%{http_code}\n" \
  "localhost:3000/api/adapt/<1-kullanicinin-id>"
```

Beklenen: **404**. 403 görürsen `ensureOwner` yanlış kullanılmış.

Bu elle doğrulama Görev 5'te otomatik teste dönüşecek; şimdilik gözle.

- [ ] **Adım 6: Commit**

```bash
pnpm --filter @uyarla/web test
pnpm --filter @uyarla/web typecheck
pnpm --filter @uyarla/web build
git add apps/web
git commit -m "feat: route'lara sahiplik kontrolü"
```

---

### Görev 5: Anonim oturum ve devralma

Spec §7. Sprintin en riskli parçası: `onLinkAccount` yanlış çalışırsa
kullanıcı emeğini kaybeder ya da daha kötüsü, bir kullanıcının CV'si
başkasının hesabına bağlanır.

**Dosyalar:**
- Oluştur: `apps/web/lib/devral.ts`
- Test: `apps/web/lib/devral.test.ts`
- Test: `apps/web/lib/devral.integration.test.ts`
- Oluştur: `apps/web/vitest.integration.config.ts`
- Değiştir: `apps/web/lib/auth.ts` (`onLinkAccount` bağlanır)
- Değiştir: `apps/web/app/api/analyze/route.ts` (anonim oturum + sahiplik)
- Değiştir: `apps/web/package.json` (`test:integration` betiği)

Spec §11 bu görevin iki tümleşik testini şart koşuyor (spec §11): devralma
ve yetki sızıntısı. İkisi de gerçek veritabanına karşı koşuyor.

**Arayüzler:**
- Tüketir: Görev 3'ten `getSession`, `ensureSession`.
- Üretir:
  - `devralmaIslemleri(anonimId: string, yeniId: string): PrismaPromise[]`
  - `auth` yapılandırmasında etkin `onLinkAccount`
- Görev 6, 7 bu akışın üstüne kuruluyor.

- [ ] **Adım 1: Devralma testini yaz**

Saf kısım: hangi tabloların hangi koşulla güncelleneceği. Prisma çağrılarını
üretip döndürmek, bunu veritabanı olmadan test edilebilir kılıyor.

`apps/web/lib/devral.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { devralmaIslemleri } from "./devral"

/** Hangi tabloya hangi where/data ile gidildiğini yakalayan sahte Prisma. */
function sahtePrisma() {
  const cagrilar: Array<{ tablo: string; where: unknown; data: unknown }> = []
  const yap = (tablo: string) => ({
    updateMany: vi.fn((args: { where: unknown; data: unknown }) => {
      cagrilar.push({ tablo, ...args })
      return { count: 0 }
    }),
  })
  return {
    cagrilar,
    client: { resume: yap("resume"), analysis: yap("analysis"), jobPosting: yap("jobPosting") },
  }
}

describe("devralmaIslemleri", () => {
  it("üç tabloyu da anonim kullanıcıdan yeni kullanıcıya taşır", () => {
    const { cagrilar, client } = sahtePrisma()
    devralmaIslemleri(client as never, "anon1", "yeni1")
    expect(cagrilar.map((c) => c.tablo).sort()).toEqual(["analysis", "jobPosting", "resume"])
  })

  it("yalnızca anonim kullanıcının satırlarını hedefler", () => {
    // En kritik kural: where koşulu düşerse BÜTÜN kullanıcıların verisi
    // tek hesaba taşınır.
    const { cagrilar, client } = sahtePrisma()
    devralmaIslemleri(client as never, "anon1", "yeni1")
    for (const c of cagrilar) {
      expect(c.where).toEqual({ userId: "anon1" })
      expect(c.data).toEqual({ userId: "yeni1" })
    }
  })

  it("aynı kimlikte hiçbir işlem üretmez", () => {
    // Kendine taşımak anlamsız ve bir hata işareti.
    const { cagrilar, client } = sahtePrisma()
    devralmaIslemleri(client as never, "ayni", "ayni")
    expect(cagrilar).toHaveLength(0)
  })

  it("boş kimlikte hata fırlatır", () => {
    const { client } = sahtePrisma()
    expect(() => devralmaIslemleri(client as never, "", "yeni1")).toThrow(/kimlik/i)
    expect(() => devralmaIslemleri(client as never, "anon1", "")).toThrow(/kimlik/i)
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/web test lib/devral`
Beklenen: FAIL — `Cannot find module './devral'`

- [ ] **Adım 3: Devralmayı uygula**

`apps/web/lib/devral.ts`:

```ts
import type { PrismaClient } from "@prisma/client"

/** `$transaction`'a verilebilecek, sahipliği taşıyan işlemler. */
type Islem = ReturnType<PrismaClient["resume"]["updateMany"]>

/**
 * Anonim kullanıcının işini yeni hesaba taşıyan işlemleri üretir.
 *
 * İşlemler döndürülüyor, çalıştırılmıyor: çağıran hepsini tek
 * `$transaction` içinde koşturuyor. Yarısı taşınmış bir kullanıcı, hiç
 * taşınmamış kullanıcıdan daha kötü — skorunu görüyor ama CV'si yok.
 *
 * `where` koşulu bu dosyanın en kritik satırı: düşerse bütün kullanıcıların
 * verisi tek hesaba taşınır. Testi bu yüzden koşulu birebir doğruluyor.
 */
export function devralmaIslemleri(
  prisma: PrismaClient,
  anonimId: string,
  yeniId: string,
): Islem[] {
  if (!anonimId || !yeniId) throw new Error("Devralma için iki kimlik de gerekli")
  // Kendine taşımak anlamsız ve bir hata işareti; sessizce geçmek yerine
  // hiçbir şey yapmıyoruz.
  if (anonimId === yeniId) return []

  const kosul = { where: { userId: anonimId }, data: { userId: yeniId } }
  return [
    prisma.resume.updateMany(kosul),
    prisma.analysis.updateMany(kosul),
    prisma.jobPosting.updateMany(kosul),
  ]
}
```

- [ ] **Adım 4: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/web test lib/devral`
Beklenen: PASS — 4 test geçti.

- [ ] **Adım 5: `onLinkAccount`'a bağla**

`apps/web/lib/auth.ts` içinde `anonymous()` çağrısını değiştir:

```ts
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        // Tek işlemde: yarısı taşınmış bir kullanıcı, hiç taşınmamıştan
        // daha kötü — skorunu görüyor ama CV'si yok (spec §7).
        await prisma.$transaction(
          devralmaIslemleri(prisma, anonymousUser.user.id, newUser.user.id),
        )
      },
    }),
```

import satırını ekle:

```ts
import { devralmaIslemleri } from "./devral"
```

- [ ] **Adım 6: Analiz ucunda anonim oturum aç ve sahipliği yaz**

`apps/web/app/api/analyze/route.ts` — `TEST_USER_EMAIL` sabitini ve
`prisma.user.upsert` bloğunu sil, yerine:

```ts
    // Oturum yoksa anonim aç. Sayfa yüklenince değil burada: her ziyaretçiye
    // kullanıcı kaydı açmanın anlamı yok, sadece iş üretenlere gerekiyor
    // (spec §7).
    let oturum = await getSession()
    if (!oturum) {
      await auth.api.signInAnonymous({ headers: await headers() })
      oturum = await getSession()
    }
    const { user } = ensureSession(oturum)
```

ve kayıt oluşturmalarına sahipliği ekle:

```ts
    const resume = await prisma.resume.create({
      data: { userId: user.id, filePath, rawText: "" },
    })

    const posting = await prisma.jobPosting.create({
      data: { userId: user.id, position: "", rawText: jobText, requirements: [], language: "tr" },
    })
```

import satırlarını ekle:

```ts
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { authErrorResponse, ensureSession, getSession } from "@/lib/authz"
```

ve `catch` bloğunun başına:

```ts
    const yetkiYaniti = authErrorResponse(error)
    if (yetkiYaniti) return yetkiYaniti
```

- [ ] **Adım 7: Worker `Analysis` kaydına sahibi yazsın**

`Analysis` artık `userId` istiyor ve kaydı worker açıyor.

`apps/worker/src/types.ts` içinde `AnalysisStore.createAnalysis` imzasını
genişlet:

```ts
  createAnalysis(input: {
    jobPostingId: string
    modelId: string
    /** Sahiplik; yetki kontrolü buna bakıyor (spec §5). */
    userId: string
  }): Promise<string>
```

`PipelineInput`'a ekle:

```ts
export interface PipelineInput {
  resumeId: string
  jobPostingId: string
  userId: string
}
```

`apps/worker/src/pipeline.ts` içinde:

```ts
  const analysisId = await deps.store.createAnalysis({
    jobPostingId: input.jobPostingId,
    modelId: deps.modelId,
    userId: input.userId,
  })
```

`apps/worker/src/store.ts` içinde:

```ts
  async createAnalysis({ jobPostingId, modelId, userId }) {
    const analysis = await prisma.analysis.create({
      data: { jobPostingId, modelId, userId, status: "running" },
    })
    return analysis.id
  },
```

`apps/worker/src/queue.ts` içinde:

```ts
export interface AnalyzeJobData {
  resumeId: string
  jobPostingId: string
  userId: string
}
```

`apps/worker/src/index.ts` içindeki `runAnalysis` çağrısına:

```ts
        { resumeId: job.data.resumeId, jobPostingId: job.data.jobPostingId, userId: job.data.userId },
```

ve `apps/web/app/api/analyze/route.ts` içindeki kuyruk çağrısına:

```ts
    const job = await analyzeQueue.add(
      "analyze",
      { resumeId: resume.id, jobPostingId: posting.id, userId: user.id },
      ANALYZE_JOB_OPTIONS,
    )
```

Worker testlerindeki sahte store çağrılarını da güncelle
(`apps/worker/src/pipeline.test.ts`): `createAnalysis` beklentilerine
`userId` eklenecek.

- [ ] **Adım 8: Tümleşik test yapılandırmasını kur**

`apps/web/vitest.integration.config.ts`:

```ts
import { defineConfig } from "vitest/config"

/**
 * Gerçek veritabanına karşı koşan testler. Ayrı yapılandırma: bunlar
 * Postgres ister ve normal `pnpm test` çalışırken ayakta olmayabilir.
 */
export default defineConfig({
  test: { include: ["lib/**/*.integration.test.ts"], testTimeout: 30000 },
})
```

`apps/web/package.json` betiklerine ekle:

```json
    "test:integration": "dotenv -e ../../.env -- vitest run --config vitest.integration.config.ts"
```

ve `dotenv-cli`'ı devDependency olarak ekle:

```bash
pnpm --filter @uyarla/web add -D dotenv-cli
```

- [ ] **Adım 9: Devralma tümleşik testini yaz**

Sprintin en riskli parçası bu; gerçek veritabanı olmadan doğrulanamaz.

`apps/web/lib/devral.integration.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest"
import { prisma } from "@uyarla/db"
import { devralmaIslemleri } from "./devral"

const temizlenecek: string[] = []

afterEach(async () => {
  // Sıra önemli: yabancı anahtarlar önce çocukları istiyor.
  await prisma.analysis.deleteMany({ where: { userId: { in: temizlenecek } } })
  await prisma.resume.deleteMany({ where: { userId: { in: temizlenecek } } })
  await prisma.jobPosting.deleteMany({ where: { userId: { in: temizlenecek } } })
  await prisma.user.deleteMany({ where: { id: { in: temizlenecek } } })
  temizlenecek.length = 0
})

async function kullaniciYap(ad: string) {
  const u = await prisma.user.create({
    data: { name: ad, email: `${ad}-${Date.now()}@test.local` },
  })
  temizlenecek.push(u.id)
  return u
}

async function isUret(userId: string) {
  const resume = await prisma.resume.create({
    data: { userId, filePath: "/tmp/x.pdf", rawText: "metin" },
  })
  const posting = await prisma.jobPosting.create({
    data: { userId, position: "", rawText: "ilan", requirements: [], language: "tr" },
  })
  const analysis = await prisma.analysis.create({
    data: { userId, jobPostingId: posting.id, modelId: "test", status: "done", score: 42 },
  })
  return { resume, posting, analysis }
}

describe("devralma · gerçek veritabanı", () => {
  it("anonim kullanıcının işini yeni hesaba taşır", async () => {
    const anonim = await kullaniciYap("anonim")
    const yeni = await kullaniciYap("yeni")
    const { resume, posting, analysis } = await isUret(anonim.id)

    await prisma.$transaction(devralmaIslemleri(prisma, anonim.id, yeni.id))

    expect((await prisma.resume.findUnique({ where: { id: resume.id } }))!.userId).toBe(yeni.id)
    expect((await prisma.analysis.findUnique({ where: { id: analysis.id } }))!.userId).toBe(yeni.id)
    expect((await prisma.jobPosting.findUnique({ where: { id: posting.id } }))!.userId).toBe(yeni.id)
  })

  it("başka kullanıcıların verisine DOKUNMAZ", async () => {
    // Bu testin varlık sebebi: where koşulu düşerse bütün kullanıcıların
    // verisi tek hesaba taşınır ve bu kişisel veri sızıntısıdır.
    const anonim = await kullaniciYap("anonim")
    const yeni = await kullaniciYap("yeni")
    const baskasi = await kullaniciYap("baskasi")

    await isUret(anonim.id)
    const digerininIsi = await isUret(baskasi.id)

    await prisma.$transaction(devralmaIslemleri(prisma, anonim.id, yeni.id))

    const digerininResume = await prisma.resume.findUnique({
      where: { id: digerininIsi.resume.id },
    })
    expect(digerininResume!.userId).toBe(baskasi.id)
  })

  it("taşınacak iş yoksa sessizce geçer", async () => {
    const anonim = await kullaniciYap("anonim")
    const yeni = await kullaniciYap("yeni")
    await expect(
      prisma.$transaction(devralmaIslemleri(prisma, anonim.id, yeni.id)),
    ).resolves.toBeDefined()
  })
})
```

- [ ] **Adım 10: Tümleşik testi çalıştır**

Postgres ayakta olmalı.

```bash
pnpm --filter @uyarla/web test:integration
```

Beklenen: PASS — 3 test geçti. "Başka kullanıcıların verisine DOKUNMAZ"
testi kırmızıya dönerse **devam etme**: `where` koşulu bozuk demektir ve bu
kişisel veri sızıntısıdır.

- [ ] **Adım 11: Yetki sızıntısı tümleşik testini yaz**

Spec §11 bunu şart koşuyor ve Görev 4'te yalnızca gözle doğrulamıştık.
Sahiplik zinciri `Adaptation → Analysis → userId` üzerinden gidiyor; hatanın
saklanabileceği yer tam burası.

`apps/web/lib/authz.integration.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest"
import { prisma } from "@uyarla/db"
import { AuthError, ensureOwner } from "./authz"
import { loadAdaptation } from "./adaptation"

const temizlenecek: string[] = []

afterEach(async () => {
  await prisma.adaptation.deleteMany({ where: { analysis: { userId: { in: temizlenecek } } } })
  await prisma.analysis.deleteMany({ where: { userId: { in: temizlenecek } } })
  await prisma.jobPosting.deleteMany({ where: { userId: { in: temizlenecek } } })
  await prisma.user.deleteMany({ where: { id: { in: temizlenecek } } })
  temizlenecek.length = 0
})

async function kullaniciYap(ad: string) {
  const u = await prisma.user.create({
    data: { name: ad, email: `${ad}-${Date.now()}@test.local` },
  })
  temizlenecek.push(u.id)
  return u
}

describe("sahiplik zinciri · gerçek veritabanı", () => {
  it("başkasının uyarlaması 404 veriyor", async () => {
    const sahibi = await kullaniciYap("sahibi")
    const digeri = await kullaniciYap("digeri")

    const posting = await prisma.jobPosting.create({
      data: {
        userId: sahibi.id,
        position: "",
        rawText: "ilan",
        requirements: [],
        language: "tr",
      },
    })
    const analysis = await prisma.analysis.create({
      data: {
        userId: sahibi.id,
        jobPostingId: posting.id,
        modelId: "test",
        status: "done",
        score: 42,
      },
    })
    const adaptation = await prisma.adaptation.create({
      data: { analysisId: analysis.id, draft: {}, modelId: "test", status: "draft" },
    })

    const yuk = await loadAdaptation(adaptation.id)
    expect(yuk).not.toBeNull()

    // Sahibi erişebiliyor.
    expect(() =>
      ensureOwner(yuk!.ownerId, { user: { id: sahibi.id, isAnonymous: false } }),
    ).not.toThrow()

    // Başkası 404 alıyor — 403 değil (spec §8).
    try {
      ensureOwner(yuk!.ownerId, { user: { id: digeri.id, isAnonymous: false } })
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).status).toBe(404)
    }
  })
})
```

Çalıştır: `pnpm --filter @uyarla/web test:integration`
Beklenen: PASS — 4 test geçti (devralma 3, sahiplik 1).

- [ ] **Adım 12: Uçtan uca elle doğrula**

```bash
# 1. Kayıtsız analiz
curl -s -c kavanoz.txt -X POST localhost:3000/api/analyze \
  -F "cv=@docs/cvler/Doganay_Balaban_CV.docx" -F "jobText=<docs/ilan/1.txt"
# → jobId döner, analiz çalışır

# 2. Anonim kullanıcı uyarlama deneyince reddedilmeli
curl -s -b kavanoz.txt -X POST localhost:3000/api/adapt \
  -H 'content-type: application/json' -d '{"analysisId":"<id>"}' -w "\nHTTP %{http_code}\n"
# → 401, kod "kayit_gerekli"

# 3. Magic link ile giriş yap (terminaldeki bağlantıyı aynı kavanozla aç)
curl -s -b kavanoz.txt -c kavanoz.txt -X POST localhost:3000/api/auth/sign-in/magic-link \
  -H 'content-type: application/json' -d '{"email":"aday@ornek.com"}'
curl -s -b kavanoz.txt -c kavanoz.txt "<terminaldeki bağlantı>" -o /dev/null

# 4. Aynı analiz artık uyarlanabilmeli
curl -s -b kavanoz.txt -X POST localhost:3000/api/adapt \
  -H 'content-type: application/json' -d '{"analysisId":"<id>"}' -w "\nHTTP %{http_code}\n"
# → 200
```

Beklenen: 2. adımda 401, 4. adımda 200. Devralma çalışmazsa 4. adımda 404
gelir — analiz hâlâ anonim kullanıcıda demektir.

- [ ] **Adım 13: Commit**

```bash
pnpm --filter @uyarla/web test
pnpm --filter @uyarla/web test:integration
pnpm --filter @uyarla/worker test
pnpm -r typecheck
git add apps/web apps/worker pnpm-lock.yaml
git commit -m "feat: anonim oturum ve kayıt anında işin devralınması"
```

---

### Görev 6: Hız limiti

Spec §9. Pahalı uçlar korunuyor: her çağrı ~60 saniyelik LLM işi başlatıyor.

**Dosyalar:**
- Oluştur: `apps/web/lib/redis.ts`
- Oluştur: `apps/web/lib/rateLimit.ts`
- Test: `apps/web/lib/rateLimit.test.ts`
- Değiştir: `apps/web/lib/queue.ts`, `apps/web/lib/adaptQueue.ts` (paylaşılan bağlantı)
- Değiştir: `apps/web/app/api/analyze/route.ts`
- Değiştir: `apps/web/app/api/adapt/route.ts`

**Arayüzler:**
- Tüketir: Görev 3'ten `AuthError`, `authErrorResponse`.
- Üretir:
  - `interface RateLimitStore { incr(key: string, windowSeconds: number): Promise<number> }`
  - `RATE_LIMITS = { anonim: { limit, windowSeconds }, kayitli: { limit, windowSeconds } }`
  - `enforceRateLimit(store, key, kural): Promise<void>` (aşılırsa `AuthError` 429)
  - `redisStore: RateLimitStore`
  - `redis` (paylaşılan `IORedis` örneği)

- [ ] **Adım 1: Testi yaz**

`apps/web/lib/rateLimit.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { AuthError } from "./authz"
import { RATE_LIMITS, enforceRateLimit, type RateLimitStore } from "./rateLimit"

/** Sayaç değerlerini sırayla döndüren sahte depo. */
function sahteDepo(degerler: number[]): RateLimitStore & { cagrilar: string[] } {
  const cagrilar: string[] = []
  let i = 0
  return {
    cagrilar,
    incr: vi.fn(async (key: string) => {
      cagrilar.push(key)
      return degerler[i++] ?? 1
    }),
  }
}

const kural = { limit: 3, windowSeconds: 3600 }

describe("enforceRateLimit", () => {
  it("limit altındayken geçirir", async () => {
    await expect(enforceRateLimit(sahteDepo([1]), "k", kural)).resolves.toBeUndefined()
    await expect(enforceRateLimit(sahteDepo([3]), "k", kural)).resolves.toBeUndefined()
  })

  it("limit aşılınca 429 fırlatır", async () => {
    try {
      await enforceRateLimit(sahteDepo([4]), "k", kural)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError)
      expect((e as AuthError).status).toBe(429)
      expect((e as AuthError).code).toBe("limit_asildi")
    }
  })

  it("mesaj Türkçe ve suçlamayan", async () => {
    // Marka rehberi §6: kullanıcıyı suçlamıyoruz.
    try {
      await enforceRateLimit(sahteDepo([9]), "k", kural)
    } catch (e) {
      expect((e as AuthError).message).toMatch(/[çğıöşüÇĞİÖŞÜ]/)
      expect((e as AuthError).message).not.toMatch(/çok fazla istek attın|engellendin/i)
    }
  })

  it("anahtarı pencere ve kuralla birlikte üretir", async () => {
    // Aynı kullanıcının analiz ve uyarlama limitleri karışmamalı.
    const depo = sahteDepo([1])
    await enforceRateLimit(depo, "analiz:u1", kural)
    expect(depo.cagrilar[0]).toContain("analiz:u1")
  })

  it("varsayılan limitler tanımlı", () => {
    // Değerler tahmin; yapılandırmada durmaları bilinçli (spec §9).
    expect(RATE_LIMITS.anonim.limit).toBe(3)
    expect(RATE_LIMITS.kayitli.limit).toBe(10)
    expect(RATE_LIMITS.anonim.windowSeconds).toBe(3600)
  })
})
```

- [ ] **Adım 2: Testi çalıştır, başarısız olduğunu gör**

Çalıştır: `pnpm --filter @uyarla/web test lib/rateLimit`
Beklenen: FAIL — `Cannot find module './rateLimit'`

- [ ] **Adım 3: Paylaşılan Redis bağlantısını ayır**

`apps/web/lib/redis.ts`:

```ts
import IORedis from "ioredis"

const globalForRedis = globalThis as unknown as { redis?: IORedis }

/**
 * Paylaşılan Redis bağlantısı.
 *
 * Kuyruklar ve hız limiti aynı bağlantıyı kullanıyor. Next geliştirme
 * modunda modülleri yeniden yüklediği için global'de saklanıyor; aksi hâlde
 * her yeniden yüklemede yeni bağlantı açılır ve birikirler.
 */
export const redis =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  })

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis
```

`apps/web/lib/queue.ts` ve `apps/web/lib/adaptQueue.ts` içindeki
`new IORedis(...)` çağrılarını `redis` ile değiştir:

```ts
import { redis } from "./redis"
// …
  new Queue<AnalyzeJobData, string>(ANALYZE_QUEUE, { connection: redis })
```

- [ ] **Adım 4: Hız limitini yaz**

`apps/web/lib/rateLimit.ts`:

```ts
import { AuthError } from "./authz"
import { redis } from "./redis"

export interface RateLimitKural {
  limit: number
  windowSeconds: number
}

/** Test edilebilirlik için daraltılmış depo yüzeyi. */
export interface RateLimitStore {
  /** Anahtarı artırır ve pencere içindeki yeni değeri döndürür. */
  incr(key: string, windowSeconds: number): Promise<number>
}

/**
 * Başlangıç değerleri — bunlar TAHMİN.
 *
 * Gerçek rakam kullanım verisiyle ayarlanacak (spec §9). Sprint 2'deki eşik
 * taramasında olduğu gibi: karar ölçümle verilir, sezgiyle değil.
 */
export const RATE_LIMITS = {
  anonim: { limit: 3, windowSeconds: 3600 },
  kayitli: { limit: 10, windowSeconds: 3600 },
} satisfies Record<string, RateLimitKural>

/**
 * Sabit pencereli sayaç.
 *
 * Kayan pencere daha adil olurdu ama Redis'te sıralı küme gerektiriyor;
 * pahalı uçları korumak için sabit pencere yeterli ve okunması kolay.
 */
export const redisStore: RateLimitStore = {
  async incr(key, windowSeconds) {
    const deger = await redis.incr(key)
    // Yalnızca ilk artışta süre veriliyor; her çağrıda vermek pencereyi
    // sürekli ileri iter ve limit hiç sıfırlanmaz.
    if (deger === 1) await redis.expire(key, windowSeconds)
    return deger
  },
}

/** Limit aşılırsa 429'luk AuthError fırlatır. */
export async function enforceRateLimit(
  store: RateLimitStore,
  key: string,
  kural: RateLimitKural,
): Promise<void> {
  // Pencere numarası anahtara giriyor: süre dolduğunda anahtar da değişiyor
  // ve sayaç kendiliğinden sıfırlanıyor.
  const pencere = Math.floor(Date.now() / 1000 / kural.windowSeconds)
  const tamAnahtar = `hiz:${key}:${pencere}`

  const sayi = await store.incr(tamAnahtar, kural.windowSeconds)
  if (sayi > kural.limit) {
    throw new AuthError(
      "Çok hızlı gidiyoruz. Bir saat sonra tekrar dener misin?",
      429,
      "limit_asildi",
    )
  }
}
```

- [ ] **Adım 5: Testi çalıştır, geçtiğini gör**

Çalıştır: `pnpm --filter @uyarla/web test lib/rateLimit`
Beklenen: PASS — 5 test geçti.

- [ ] **Adım 6: Pahalı uçlara bağla**

`apps/web/app/api/analyze/route.ts` içinde, oturum alındıktan hemen sonra:

```ts
    await enforceRateLimit(
      redisStore,
      `analiz:${user.id}`,
      user.isAnonymous ? RATE_LIMITS.anonim : RATE_LIMITS.kayitli,
    )
```

`apps/web/app/api/adapt/route.ts` içinde, yetki kontrolünden sonra:

```ts
    await enforceRateLimit(redisStore, `uyarla:${oturum.user.id}`, RATE_LIMITS.kayitli)
```

İki dosyaya da import ekle:

```ts
import { RATE_LIMITS, enforceRateLimit, redisStore } from "@/lib/rateLimit"
```

`AuthError` zaten `authErrorResponse` ile yakalanıyor, ek `catch` gerekmiyor.

- [ ] **Adım 7: Elle doğrula**

```bash
for i in 1 2 3 4; do
  curl -s -b kavanoz.txt -o /dev/null -w "%{http_code} " -X POST localhost:3000/api/analyze \
    -F "cv=@docs/cvler/Doganay_Balaban_CV.docx" -F "jobText=<docs/ilan/1.txt"
done; echo
```

Beklenen (kayıtsız): `200 200 200 429`.

- [ ] **Adım 8: Commit**

```bash
pnpm --filter @uyarla/web test
pnpm --filter @uyarla/web typecheck
git add apps/web
git commit -m "feat: pahalı uçlarda hız limiti"
```

---

### Görev 7: Giriş ekranı ve oturum çubuğu

Spec §2. Arayüz geçici ve ileride komple yenilenecek — cilaya yatırım yok,
çalışan en sade hâl.

**Dosyalar:**
- Oluştur: `apps/web/app/giris/page.tsx`
- Oluştur: `apps/web/app/components/OturumCubugu.tsx`
- Değiştir: `apps/web/app/layout.tsx`
- Değiştir: `apps/web/app/test/page.tsx` (401 → giriş yönlendirmesi)

**Arayüzler:**
- Tüketir: Görev 2'den `authClient`, `signIn`, `signOut`, `useSession`.
- Üretir: `/giris` sayfası; her sayfada oturum çubuğu.

- [ ] **Adım 1: Giriş ekranını yaz**

`apps/web/app/giris/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { signIn } from "@/lib/authClient"

export default function GirisPage() {
  const [email, setEmail] = useState("")
  const [durum, setDurum] = useState<"bos" | "gonderiliyor" | "gonderildi">("bos")
  const [hata, setHata] = useState<string | null>(null)

  async function gonder(event: React.FormEvent) {
    event.preventDefault()
    setHata(null)
    setDurum("gonderiliyor")

    const { error } = await signIn.magicLink({
      email,
      // Giriş sonrası kullanıcıyı bıraktığı yere değil ana akışa alıyoruz;
      // dönüş adresi takibi Sprint 3B'nin işi.
      callbackURL: "/test",
    })

    if (error) {
      setHata("Bağlantıyı gönderemedik. Birazdan tekrar dener misin?")
      setDurum("bos")
      return
    }
    setDurum("gonderildi")
  }

  if (durum === "gonderildi") {
    return (
      <main>
        <h1>Posta kutunu kontrol et</h1>
        <p>
          <strong>{email}</strong> adresine bir giriş bağlantısı gönderdik.
          Bağlantı 15 dakika geçerli.
        </p>
        <p className="meta">
          Gelmediyse spam klasörüne bak, ya da{" "}
          <button className="btn-ikincil" onClick={() => setDurum("bos")}>
            tekrar dene
          </button>
        </p>
      </main>
    )
  }

  return (
    <main>
      <h1>Giriş yap</h1>
      <p className="meta">
        Parola yok. E-postanı bırak, sana bir giriş bağlantısı gönderelim.
      </p>

      <form onSubmit={gonder} style={{ marginTop: "1.5rem", maxWidth: "24rem" }}>
        <label htmlFor="email">E-posta</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="aday@ornek.com"
          style={{
            width: "100%",
            padding: "0.6rem",
            border: "1px solid var(--cizgi)",
            borderRadius: "var(--yaricap-buton)",
            background: "var(--kart)",
            color: "var(--metin)",
            font: "inherit",
          }}
        />
        {hata && <p className="gerekce">{hata}</p>}
        <p>
          <button className="btn-birincil" type="submit" disabled={durum === "gonderiliyor"}>
            {durum === "gonderiliyor" ? "Gönderiliyor…" : "Bağlantıyı gönder"}
          </button>
        </p>
      </form>

      <p className="meta">Kayıt gerekmez · CV'n izinsiz paylaşılmaz</p>
    </main>
  )
}
```

- [ ] **Adım 2: Oturum çubuğunu yaz**

`apps/web/app/components/OturumCubugu.tsx`:

```tsx
"use client"

import { signOut, useSession } from "@/lib/authClient"

/**
 * Kim giriş yapmış ve çıkış bağlantısı.
 *
 * Anonim oturum "giriş yapılmış" sayılmıyor: kullanıcı açısından o bir
 * oturum değil, sadece işinin kaybolmamasını sağlayan bir iz.
 */
export function OturumCubugu() {
  const { data, isPending } = useSession()
  if (isPending) return null

  const kullanici = data?.user
  const kayitli = kullanici && !(kullanici as { isAnonymous?: boolean }).isAnonymous

  return (
    <div
      className="meta"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid var(--cizgi)",
        paddingBottom: "0.6rem",
        marginBottom: "1.5rem",
      }}
    >
      <span style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800 }}>uyarla</span>
      {kayitli ? (
        <span>
          {kullanici.email}{" "}
          <button className="btn-ikincil" onClick={() => void signOut()}>
            Çıkış
          </button>
        </span>
      ) : (
        <a href="/giris">Giriş yap</a>
      )}
    </div>
  )
}
```

- [ ] **Adım 3: Yerleşime ekle**

`apps/web/app/layout.tsx` içindeki `<body>` gövdesini değiştir:

```tsx
      <body>
        <OturumCubugu />
        {children}
      </body>
```

ve import ekle:

```tsx
import { OturumCubugu } from "./components/OturumCubugu"
```

- [ ] **Adım 4: Test sayfasında kayıt çağrısını karşıla**

`apps/web/app/test/page.tsx` içindeki `uyarla` fonksiyonunda, hata
durumunda kodu kontrol et:

```ts
    if (cevap.ok && govde.adaptationId) {
      window.location.href = `/adapt/${govde.adaptationId}`
      return
    }
    // Anonim kullanıcı uyarlama isteyince kayıt gerekiyor (spec §7); hata
    // göstermek yerine doğrudan giriş ekranına alıyoruz.
    if (govde.code === "kayit_gerekli") {
      window.location.href = "/giris"
      return
    }
    setError(govde.error ?? "Uyarlama başlatılamadı.")
    setBusy(false)
```

`govde` tipini genişlet:

```ts
    const govde = (await cevap.json()) as {
      adaptationId?: string
      error?: string
      code?: string
    }
```

- [ ] **Adım 5: Süresi geçmiş bağlantıyı karşıla**

Spec §10'un hata tablosu bu mesajı şart koşuyor: *"Bu bağlantının süresi dolmuş. Yenisini
gönderelim mi?"* Better Auth doğrulama başarısız olunca giriş adresine
`?error=<kod>` ekleyerek dönüyor.

`apps/web/app/giris/page.tsx` içinde, bileşenin başına ekle:

```tsx
/**
 * Better Auth'un hata kodlarını Türkçe mesaja çeviriyor.
 *
 * Bilinmeyen kod için genel mesaj: kullanıcıya İngilizce bir kod
 * göstermenin hiçbir faydası yok.
 */
function hataMesaji(kod: string | null): string | null {
  if (!kod) return null
  if (/EXPIRED|INVALID/i.test(kod)) {
    return "Bu bağlantının süresi dolmuş. Yenisini gönderelim mi?"
  }
  return "Giriş yapılamadı. E-postanı tekrar girer misin?"
}
```

ve `GirisPage` gövdesinin başına:

```tsx
  const [urlHatasi] = useState(() =>
    typeof window === "undefined"
      ? null
      : hataMesaji(new URLSearchParams(window.location.search).get("error")),
  )
```

Formdaki hata satırını ikisini de gösterecek hâle getir:

```tsx
        {(hata ?? urlHatasi) && <p className="gerekce">{hata ?? urlHatasi}</p>}
```

- [ ] **Adım 6: Elle doğrula**

Tarayıcıda:

1. `/test` — sağ üstte "Giriş yap" görünmeli
2. CV yükle + ilan yapıştır → skor gelmeli (kayıtsız)
3. "CV'mi bu ilana uyarla" → `/giris`'e yönlenmeli
4. E-posta gir → "Posta kutunu kontrol et" ekranı
5. Terminaldeki bağlantıyı aç → `/test`'e dönmeli, sağ üstte e-posta ve "Çıkış"
6. Aynı analizden uyarlama başlat → çalışmalı, skor korunmuş olmalı

6. adım devralmanın uçtan uca kanıtı: skor kaybolduysa iş taşınmamış demektir.

Ayrıca süresi geçmiş bağlantıyı dene: `/giris?error=EXPIRED_TOKEN` adresini
aç, Türkçe mesaj görünmeli.

- [ ] **Adım 7: Commit**

```bash
pnpm --filter @uyarla/web test
pnpm --filter @uyarla/web typecheck
pnpm --filter @uyarla/web build
git add apps/web
git commit -m "feat: giriş ekranı ve oturum çubuğu"
```

---

## Sprint Sonu

```bash
pnpm -r test
pnpm --filter @uyarla/web test:integration
pnpm -r typecheck
pnpm --filter @uyarla/web build
```

Spec §12'deki tamamlanma tanımını tek tek geç:

```
[ ] Kullanıcı e-postasıyla giriş yapabiliyor (magic link)
[ ] Kayıtsız ziyaretçi skor alabiliyor
[ ] Kayıt olunca CV, analiz ve ilan yeni hesaba geçiyor; anonim kullanıcı siliniyor
[ ] Anonim kullanıcı uyarlama başlatamıyor, kayıt çağrısı alıyor
[ ] Başkasının analizi veya uyarlaması 404 dönüyor (tümleşik testle doğrulanmış)
[ ] Hız limiti çalışıyor ve aşıldığında 429 dönüyor
[ ] Arayüzde oturum durumu ve çıkış görünüyor
[ ] RESEND_API_KEY olmadan geliştirme yapılabiliyor (link konsola düşüyor)
```

Açık kalan işler `docs/birikmis-isler.md`'ye yazılır. Bu sprintin bilinen
açıkları şimdiden belli:

- **Gerçek e-posta denenmedi.** Resend hesabı ve alan adı doğrulaması
  gerekiyor; magic link'in spam'e düşüp düşmediği K3'ten önce sınanmalı.
- **Google ile giriş yok.** `socialProviders` bloğu yerinde ve boş.
- **Hesap silme yok.** Marka rehberi "istediğin an silebilirsin" diyor;
  sahiplik alanları bunu mümkün kılıyor ama akış yazılmadı.
- **Anonim kullanıcı temizliği yok.** Kayıt olmadan giden ziyaretçilerin
  kayıtları birikiyor.
