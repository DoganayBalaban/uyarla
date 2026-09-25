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
 */

/** Depo kökünü cwd'den yukarı yürüyerek bulur. */
function depoKoku() {
  let dizin = process.cwd()
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dizin, "pnpm-workspace.yaml"))) return dizin
    const ust = dirname(dizin)
    if (ust === dizin) break
    dizin = ust
  }
  throw new Error(
    "Font dizini bulunamadı: pnpm-workspace.yaml aranarak depo köküne ulaşılamadı.",
  )
}

let onbellek = null

/**
 * Font dosyalarının diskteki yolları.
 *
 * Tembel: modül yüklenirken değil, ilk belge üretiminde hesaplanıyor. Böylece
 * paketi import eden ama PDF üretmeyen süreçler beklenmedik bir cwd yüzünden
 * patlamıyor.
 */
function fontYollari() {
  if (onbellek) return onbellek

  const dizin = join(depoKoku(), "packages", "fonts", "ttf")
  const yollar = {
    /**
     * DejaVu Sans. pdfkit'in gömülü Helvetica'sı WinAnsi kodlaması kullanıyor
     * ve ş/ğ/ı/İ orada yok; ölçümde "Geliştirici" → "Geli ÷F— ici" çıkıyordu.
     */
    regular: join(dizin, "DejaVuSans.ttf"),
    bold: join(dizin, "DejaVuSans-Bold.ttf"),
  }

  for (const yol of Object.values(yollar)) {
    if (!existsSync(yol)) throw new Error(`Font dosyası yok: ${yol}`)
  }

  onbellek = yollar
  return yollar
}

module.exports = { fontYollari }
