const gelistirme = process.env.NODE_ENV !== "production"

/**
 * Güvenlik başlıkları.
 *
 * CSP nonce'suz: Next'in hidrasyon betikleri satır içi ve nonce için her
 * isteği middleware'den geçirip sayfaları dinamik yapmak gerekiyor. Satır içi
 * betiğe izin verilse de CSP asıl işini görüyor: dış kaynaktan betik, çerçeve
 * içine alınma (clickjacking), başka adrese form gönderme ve <base> ile adres
 * kaçırma kapalı. Dış kaynak yalnızca Google Fonts (app/layout.tsx).
 * Geliştirmede React Refresh eval kullanıyor.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${gelistirme ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

const GUVENLIK_BASLIKLARI = [
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
  serverExternalPackages: ["@prisma/client", "bullmq", "ioredis", "pdfkit", "docx", "@uyarla/fonts"],

  async headers() {
    return [{ source: "/:path*", headers: GUVENLIK_BASLIKLARI }]
  },

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
