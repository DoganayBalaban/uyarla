import { join } from "node:path"
import * as esbuild from "esbuild"

/**
 * Worker'ı üretim için tek dosyaya derler (dist/index.mjs); düz node ile çalışır.
 *
 * Neden: üretimde `tsx` ile çalışınca pdfjs'nin büyük JS dosyaları her
 * yüklemede derlenip bellekte tutuluyordu. Tek PDF okuması belleği ~580 MB'a
 * çıkarıp Railway'in 512 MB sınırında süreci düşürüyordu; düz node ile aynı
 * okuma ~125 MB.
 *
 * Yalnızca çalışma alanının TypeScript paketleri (@uyarla/core, @uyarla/db)
 * pakete giriyor. Diğer bağımlılıklar dışarıda kalıyor ama mutlak yolla:
 * pnpm bağımlılıkları kökte toplamıyor, core'un bağımlılıkları worker'ın
 * klasöründen bulunamaz. Prisma, pdfjs ve fontlar diskteki yerlerinde
 * yükleniyor (yollarına bağlı kodlar bozulmuyor).
 */
const root = join(import.meta.dirname, "..")

// Kaynağı TypeScript olan çalışma alanı paketleri; @uyarla/fonts düz CJS ve
// `__dirname`'e bağlı, dışarıda kalmalı.
const BUNDLED = /^@uyarla\/(core|db)(\/|$)/

const externalDeps = {
  name: "dis-bagimliliklar",
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, async (args) => {
      if (args.pluginData?.skip || BUNDLED.test(args.path) || args.path.startsWith("node:")) return
      const resolved = await build.resolve(args.path, {
        kind: args.kind,
        resolveDir: args.resolveDir,
        importer: args.importer,
        pluginData: { skip: true },
      })
      if (resolved.errors.length) return { errors: resolved.errors }
      // Node yerleşik modülleri (fs, path...) yol değil, ad olarak kalıyor.
      return { path: resolved.external ? args.path : resolved.path, external: true }
    })
  },
}

await esbuild.build({
  entryPoints: [join(root, "src/index.ts")],
  outfile: join(root, "dist/index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  plugins: [externalDeps],
  logLevel: "warning",
})
console.log("[worker] dist/index.mjs derlendi")
