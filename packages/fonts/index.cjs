const { existsSync } = require("node:fs")
const { dirname, join } = require("node:path")

/**
 * CV çıktısında kullanılan font dosyaları.
 *
 * Fontlar depoya alındı ve çalışma anında dosya sisteminden bulunuyor —
 * modül çözümlemesiyle DEĞİL. Sebebi ölçüldü: `@uyarla/core`
 * `transpilePackages` içinde olmak zorunda (TypeScript kaynağı) ve orada
 * kalan her `require.resolve` çağrısını webpack dönüştürüyor:
 *
 *   - düz metin specifier → .ttf'i paketlemeye çalışıp derlemeyi düşürüyor
 *     ("Module parse failed: Unexpected character")
 *   - hesaplanmış specifier → çağrıyı `webpackEmptyContext` ile değiştirip
 *     çalışma anında MODULE_NOT_FOUND ürettiriyor
 *   - ayrı pakete taşımak → `serverExternalPackages` monorepo paketinde
 *     uygulanmıyor, `require.resolve` webpack modül kimliği (göreli yol)
 *     döndürüyor ve dosya açılamıyor
 *
 * Dosya sisteminden okumak bundler'ın görüş alanının tümüyle dışında.
 *
 * Bu paketin `serverExternalPackages` içinde olması işe yaramıyor: K-42'de
 * ölçüldü, `next build` çıktısında bu dosyanın kaynağı
 * `.next/server/chunks/*.js` içine olduğu gibi gömülmüş çıkıyor. Yani
 * `__dirname` ve `require.resolve` gibi modülün diskteki yerine bağlı her
 * şey paketlenmiş kopyada anlamını yitiriyor. Aşağıdaki arama bunu
 * varsayarak yazıldı.
 */

/** Font dosyalarının bulunduğu dizinin depo köküne göre yolu. */
const TARGET_DIR = join("packages", "fonts", "ttf")

/** Varlığı sınanan dosya; dizin adı tek başına yeterli kanıt değil. */
const MARKER_FILE = "DejaVuSans.ttf"

/**
 * Font dizinini bulur.
 *
 * İki aday sırayla deneniyor, ikisi de var olan bir dosyayla doğrulanıyor:
 *
 * 1. `__dirname/ttf` — bu dosya gerçek bir CJS modülü olarak yüklendiğinde
 *    (worker, testler, `tsx`) kesin doğru cevap ve cwd'den bağımsız.
 *    Paketlenmiş kopyada `__dirname` başka bir yeri gösterir; o yüzden
 *    sonucu sınanıyor, güvenilmiyor.
 *
 * 2. cwd'den yukarı yürüyüp `packages/fonts/ttf` aramak — paketlenmiş kod
 *    için kalan tek yol. ARANAN HEDEFİN KENDİSİ; eskiden
 *    `pnpm-workspace.yaml` aranıyordu ve o, depo ağacının diskte durmasını
 *    şart koşuyordu. Dağıtımda depo ağacı yok, yalnızca
 *    `outputFileTracingIncludes` ile kopyalanan `packages/fonts/ttf` var
 *    (bkz. `apps/web/next.config.mjs`). İlk adayın cwd'nin kendisi olması
 *    önemli: Vercel'de işlev kökü (`/var/task`) doğrudan bu dizini taşıyor,
 *    yukarıda hiçbir şey yok.
 */
function fontDir() {
  const besidePackage = join(__dirname, "ttf")
  if (existsSync(join(besidePackage, MARKER_FILE))) return besidePackage

  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, TARGET_DIR)
    if (existsSync(join(candidate, MARKER_FILE))) return candidate
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  throw new Error(
    `Font dizini bulunamadı: ne ${besidePackage} ne de ${process.cwd()} ve üstündeki ` +
      `dizinlerde ${TARGET_DIR} var. Dağıtımda bu, next.config.mjs'deki ` +
      `outputFileTracingIncludes girdisinin font dizinini kopyalamadığı anlamına gelir.`,
  )
}

let cached = null

/**
 * Font dosyalarının diskteki yolları.
 *
 * Tembel: modül yüklenirken değil, ilk belge üretiminde hesaplanıyor. Böylece
 * paketi import eden ama PDF üretmeyen süreçler beklenmedik bir cwd yüzünden
 * patlamıyor.
 */
function fontPaths() {
  if (cached) return cached

  const dir = fontDir()
  const paths = {
    /**
     * DejaVu Sans. pdfkit'in gömülü Helvetica'sı WinAnsi kodlaması kullanıyor
     * ve ş/ğ/ı/İ orada yok; ölçümde "Geliştirici" → "Geli ÷F— ici" çıkıyordu.
     */
    regular: join(dir, "DejaVuSans.ttf"),
    bold: join(dir, "DejaVuSans-Bold.ttf"),
  }

  for (const filePath of Object.values(paths)) {
    if (!existsSync(filePath)) throw new Error(`Font dosyası yok: ${filePath}`)
  }

  cached = paths
  return paths
}

module.exports = { fontPaths }
