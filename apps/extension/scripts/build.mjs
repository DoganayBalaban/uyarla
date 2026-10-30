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

cpSync(join(root, "popup.html"), join(dist, "popup.html"))

const shared = {
  bundle: true,
  target: "chrome120",
  define: { UYARLA_URL: JSON.stringify(uyarlaUrl) },
  logLevel: "info",
}
// Arka plan modül; sayfa betiği ve simge menüsü kendi kapsamında (iife) çalışıyor (DOG-169).
const builds = [
  { ...shared, entryPoints: [join(root, "src/background.ts")], outfile: join(dist, "background.js"), format: "esm" },
  { ...shared, entryPoints: [join(root, "src/content.ts")], outfile: join(dist, "content.js"), format: "iife" },
  { ...shared, entryPoints: [join(root, "src/popup.ts")], outfile: join(dist, "popup.js"), format: "iife" },
]

if (watch) {
  for (const options of builds) await (await esbuild.context(options)).watch()
  console.log(`[eklenti] izleniyor · UYARLA_URL=${uyarlaUrl} · Chrome'da dist/ klasörünü yükle`)
} else {
  for (const options of builds) await esbuild.build({ ...options, minify: true })
  const { version } = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"))
  const zip = new JSZip()
  for (const file of ["manifest.json", "background.js", "content.js", "popup.html", "popup.js", "icons/16.png", "icons/32.png", "icons/48.png", "icons/128.png"]) {
    zip.file(file, readFileSync(join(dist, file)))
  }
  const name = `uyarla-eklenti-${version}.zip`
  writeFileSync(join(root, name), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }))
  console.log(`[eklenti] ${name} · UYARLA_URL=${uyarlaUrl}`)
}
