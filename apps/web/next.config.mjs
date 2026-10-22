import { fileURLToPath } from "node:url"

/**
 * Dosya izlemenin kökü: monorepo kökü, `apps/web` değil.
 *
 * Next bunu kendisi tahmin ediyor ama tahmin `apps/web`'de kalabiliyor; o
 * durumda `packages/*` dağıtıma hiç girmiyor. Açıkça yazmak aşağıdaki
 * `outputFileTracingIncludes` girdilerinin de neye göre çözüldüğünü
 * belirliyor.
 */
const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

const isDev = process.env.NODE_ENV === "development"

/**
 * Güvenlik başlıkları (DOG-26).
 *
 * #58'de bu dosya yeniden yazılırken başlıklar yanlışlıkla silinmişti ve
 * üretim iki hafta CSP'siz çalıştı; `src/lib/securityHeaders.test.ts` artık
 * bunu yakalıyor.
 *
 * CSP nonce'suz, `script-src 'unsafe-inline'` bilinçli: Next'in hidrasyon
 * betikleri satır içi ve nonce her isteği middleware'den geçirip statik
 * sayfaları dinamik yapar. Satır içi betiğe izin verilse de CSP asıl işini
 * görüyor: dış kaynaktan betik, çerçeveye alınma (clickjacking), başka adrese
 * form gönderme ve <base> ile adres kaçırma kapalı. XSS'e karşı asıl savunma
 * React'in kaçışlaması; `dangerouslySetInnerHTML` kullanılmıyor (testte
 * yasak).
 *
 * Dış kaynak: tarayıcı hata izlemesinin gönderdiği Sentry AB alımı (DOG-62).
 * Yazı tipi next/font ile aynı kaynaktan (DOG-143). Geliştirmede React Refresh eval
 * kullanıyor.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Geist next/font ile aynı kaynaktan (DOG-143).
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.ingest.de.sentry.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // HTTPS'te etkili; tarayıcı yerel HTTP'de yok sayıyor.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
]

/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }]
  },

  /**
   * Sayfa yolları İngilizceye geçti. Eski adresler canlıda yayımlandı:
   * gönderilmiş e-postalardaki "aboneliği bırak" ve mülakat bağlantıları,
   * süren bir Polar ödemesinin dönüş adresi. Kırılmasınlar diye kalıcı
   * yönlendirme; sorgu (`?t=`, `?donus=`) olduğu gibi taşınıyor.
   */
  async redirects() {
    return [
      { source: "/e-posta/cik", destination: "/email/unsubscribe", permanent: true },
      { source: "/plans/tesekkurler", destination: "/plans/thanks", permanent: true },
      { source: "/applications/:id/mulakat", destination: "/applications/:id/interview", permanent: true },
    ]
  },

  /**
   * Dağıtım çıktısını yerelde inceleyebilmek için kapı.
   *
   * Vercel `output: "standalone"` kullanmıyor — kendi işlevlerini `.nft.json`
   * izlerinden kuruyor. Ama izlerin ne kopyaladığını dosya sisteminde
   * görmenin tek yerel yolu standalone çıktısı. Varsayılan olarak kapalı:
   * her derlemeye ~70 MB kopyalama maliyeti bindirmesin.
   *
   *   UYARLA_STANDALONE=1 pnpm --filter @uyarla/web build
   *
   * Doğrulama yordamı K-42'de.
   */
  output: process.env.UYARLA_STANDALONE ? "standalone" : undefined,

  outputFileTracingRoot: repoRoot,

  /**
   * Font dosyaları dağıtıma elle dahil ediliyor.
   *
   * `@uyarla/fonts` fontları çalışma anında dosya sisteminden okuyor (neden:
   * K-30) ve hiçbir yerde statik bir `import "....ttf"` yok. Dosya izleme
   * yalnızca statik bağımlılıkları görüyor, dolayısıyla `.ttf`'leri kendi
   * başına bulamıyor: ölçüldü, izlemede 0 font dosyası çıkıyordu ve PDF
   * indirme üretimde çalışma anında patlıyordu (K-42).
   *
   * Yol `outputFileTracingRoot`'a göre değil, bu dosyanın bulunduğu proje
   * dizinine (`apps/web`) göre yazılıyor — Next'in beklediği biçim bu.
   * Çıktıda dosyalar izleme köküne göre yerleşiyor: `packages/fonts/ttf/`.
   *
   * LICENSE de dahil: DejaVu yeniden dağıtılıyor, lisansı yanında gitmeli.
   */
  outputFileTracingIncludes: {
    "/api/adapt/[id]/download": ["../../packages/fonts/ttf/**"],
    // Prisma sorgu motoru (.so.node) ve şeması da çalışma anında dosya
    // sisteminden yükleniyor; @prisma/client paketlendiği için (aşağıya bak)
    // izleme onları görmüyor ve üretimde "could not locate the Query Engine"
    // ile düşülüyordu. Her rotaya ekleniyor: auth oturumu her sayfada DB'ye
    // gidiyor.
    "/**": ["../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**"],
  },

  // core, db ve worker kaynak TypeScript olarak yayımlanıyor; Next'in
  // bunları derlemesi gerekiyor.
  transpilePackages: ["@uyarla/core", "@uyarla/db", "@uyarla/worker"],

  // Sunucu tarafı kütüphaneler paketlenmiyor, çalışma zamanında require
  // ediliyor. Paketlenmeleri hâlinde:
  //   - bullmq isteğe bağlı sürücülerini (@valkey/valkey-glide) çözemiyor
  //   - Prisma ve ioredis "Object.defineProperty called on non-object" ile
  //     düşüyor (yerel eklenti ve CJS/ESM karışımı)
  // Yalnızca yerel eklenti ya da dinamik require kullananlar. mammoth ve
  // pdf-parse saf JavaScript; dışarıda bırakılınca CJS/ESM ara katmanı
  // "Object.defineProperty called on non-object" ile düşüyor.
  //
  // UYARI: Bu liste yalnızca uygulamanın KENDİ kodundan gelen import'lara
  // uygulanıyor. `transpilePackages` içindeki bir paketten (packages/core,
  // packages/db) gelen import'ta uygulanmıyor — ölçüldü (K-42): pdfkit, docx,
  // @prisma/client ve @uyarla/fonts derleme çıktısında paketlenmiş halde
  // duruyor, yalnızca bullmq ve ioredis (apps/web/lib'den import ediliyorlar)
  // gerçekten dışarıda kalıyor. @uyarla/fonts'un burada olması bu yüzden
  // etkisiz; listeden çıkarılmadı çünkü çıkarmak da bir şey değiştirmiyor ve
  // niyeti belgeliyor.
  serverExternalPackages: ["@prisma/client", "bullmq", "ioredis", "pdfkit", "docx", "@uyarla/fonts"],

  webpack(config) {
    // TypeScript ESM'de kaynak dosyalar birbirine ".js" uzantısıyla import
    // edilir (`./errors.js` aslında `errors.ts`). tsx ve vitest bunu
    // kendiliğinden çözüyor, webpack çözmüyor.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    }
    return config
  },
}
