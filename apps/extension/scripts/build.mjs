import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import * as esbuild from "esbuild"
import JSZip from "jszip"

const root = join(import.meta.dirname, "..")
const dist = join(root, "dist")
const watch = process.argv.includes("--watch")
// İzleme kipi yerel geliştirme içindir: uyarla yerel sunucuda.
const uyarlaUrl = process.env.UYARLA_URL ?? (watch ? "http://localhost:3000" : "https://uyarla.com.tr")

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
cpSync(join(root, "manifest.json"), join(dist, "manifest.json"))
cpSync(join(root, "icons"), join(dist, "icons"), { recursive: true })

const options = {
  entryPoints: [join(root, "src/background.ts")],
  outfile: join(dist, "background.js"),
  bundle: true,
  format: "esm",
  target: "chrome120",
  define: { UYARLA_URL: JSON.stringify(uyarlaUrl) },
  logLevel: "info",
}

if (watch) {
  const ctx = await esbuild.context(options)
  await ctx.watch()
  console.log(`[eklenti] izleniyor · UYARLA_URL=${uyarlaUrl} · Chrome'da dist/ klasörünü yükle`)
} else {
  await esbuild.build({ ...options, minify: true })
  const { version } = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"))
  const zip = new JSZip()
  for (const file of ["manifest.json", "background.js", "icons/16.png", "icons/32.png", "icons/48.png", "icons/128.png"]) {
    zip.file(file, readFileSync(join(dist, file)))
  }
  const name = `uyarla-eklenti-${version}.zip`
  writeFileSync(join(root, name), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }))
  console.log(`[eklenti] ${name} · UYARLA_URL=${uyarlaUrl}`)
}
