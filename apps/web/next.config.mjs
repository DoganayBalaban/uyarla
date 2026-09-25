/** @type {import('next').NextConfig} */
export default {
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
