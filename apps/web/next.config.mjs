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

/** @type {import('next').NextConfig} */
export default {
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
