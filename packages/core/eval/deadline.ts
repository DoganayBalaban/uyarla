import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { extractJobPosting } from "../src/extract/job.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv } from "../src/llm/types.js"

/**
 * Son başvuru tarihi çıkarımı (DOG-120).
 *
 * İki küme:
 *   - Değerlendirme setinin ilanları olduğu gibi: hiçbirinde son başvuru
 *     tarihi yok, hepsi null olmalı (uydurma tarih).
 *   - Gerçek ilanların ortasına bir tarih cümlesi eklenmiş vakalar: yıllı,
 *     yılsız, İngilizce, göreli ifade ve yalnızca yayın tarihi.
 *
 * Kullanım: pnpm eval:deadline
 */
const KOK = import.meta.dirname
const NOW = new Date("2026-10-20T09:00:00Z")

const ilan = (id: string) => readFileSync(join(KOK, "sources", "ilan", `${id}.txt`), "utf8")

function insert(text: string, line: string): string {
  const lines = text.split("\n")
  const mid = Math.floor(lines.length / 2)
  return [...lines.slice(0, mid), line, ...lines.slice(mid)].join("\n")
}

const CASES: Array<{ name: string; posting: string; line: string; expected: string | null }> = [
  { name: "tr-yıllı", posting: "ilan-8", line: "Son başvuru tarihi: 31.10.2026", expected: "2026-10-31" },
  { name: "tr-yılsız", posting: "ilan-11", line: "Başvurular 15 Kasım'a kadar kabul edilecektir.", expected: "2026-11-15" },
  { name: "en", posting: "ilan-3", line: "Applications close on November 7, 2026.", expected: "2026-11-07" },
  { name: "göreli", posting: "ilan-9", line: "İlanımız 2 hafta süreyle yayında kalacaktır, en kısa sürede başvurun.", expected: null },
  { name: "yayın-tarihi", posting: "ilan-6", line: "İlan tarihi: 12.10.2026", expected: null },
]

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  let wrong = 0

  console.log("Tarihsiz ilanlar (null beklenen):")
  for (const file of readdirSync(join(KOK, "sources", "ilan")).filter((f) => f.endsWith(".txt")).sort()) {
    const id = file.replace(/\.txt$/, "")
    const { data } = await extractJobPosting(llm, ilan(id), { now: NOW })
    const ok = data.deadline === null
    if (!ok) wrong++
    console.log(`  ${id.padEnd(8)} ${ok ? "✓" : `✗ ${data.deadline}`}`)
  }

  console.log("\nTarih eklenmiş ilanlar:")
  for (const c of CASES) {
    const { data } = await extractJobPosting(llm, insert(ilan(c.posting), c.line), { now: NOW })
    const ok = data.deadline === c.expected
    if (!ok) wrong++
    console.log(`  ${c.name.padEnd(14)} ${ok ? "✓" : "✗"} ${data.deadline ?? "null"} (beklenen ${c.expected ?? "null"})`)
  }
  console.log(`\nYanlış: ${wrong}`)
}

void main()
