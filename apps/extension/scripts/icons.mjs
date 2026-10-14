import { mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

// Web'in favicon kaynağı (marka simgesi); mağaza 16/32/48/128 piksel istiyor.
// Favicon saydam zeminde siyah; Chrome'un koyu araç çubuğunda kayboluyor.
// Bu yüzden koyu yuvarlak kare üzerinde beyaz logo üretiliyor.
const dir = import.meta.dirname
const logo = readFileSync(join(dir, "../../web/src/app/icon.svg"), "utf8")
  .replace(/<style>[\s\S]*?<\/style>/, "<style>path{fill:#ffffff}</style>")
const out = join(dir, "../icons")
mkdirSync(out, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  const pad = Math.round(size * 0.14)
  const mark = await sharp(Buffer.from(logo), { density: 512 }).resize(size - 2 * pad, size - 2 * pad).png().toBuffer()
  const radius = Math.round(size * 0.22)
  const tile = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#111114"/></svg>`,
  )
  await sharp(tile).composite([{ input: mark, left: pad, top: pad }]).png().toFile(join(out, `${size}.png`))
  console.log(`icons/${size}.png`)
}
