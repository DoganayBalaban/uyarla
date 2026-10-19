import { readFileSync } from "node:fs"
import { join } from "node:path"
import { extractJobPosting } from "../src/extract/job.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv } from "../src/llm/types.js"

/**
 * Koşul gereksinimleri (DOG-115): ilan çıkarımı ikamet, seyahat, askerlik,
 * ehliyet, vatandaşlık, çalışma düzeni gibi evet/hayır şartlarını `condition`
 * türüyle ayırıyor mu.
 *
 * Her ilan için koşul olması beklenen satırların bir parçası yazılı.
 * Ölçülen: yakalanan koşullar (recall) ve koşul sanılan gerçek gereksinimler
 * (yanlış koşul). Yanlış koşul daha zararlı: skordan çıkar.
 *
 * Kullanım: pnpm eval:conditions
 */
const KOK = import.meta.dirname

const EXPECTED: Record<string, string[]> = {
  "ilan-8": ["ikamet", "seyahat", "araç kullan"],
  "ilan-12": ["sürücü belgesi", "askerlik", "ikamet", "seyahat"],
  "ilan-13": ["citizen", "office", "on-call"],
  // Koşul içermeyen ilanlar: yanlış koşul ölçümü için.
  "ilan-1": [],
  "ilan-3": ["Location", "PST"],
  "ilan-6": [],
  "ilan-9": [],
}

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  let caught = 0
  let expectedTotal = 0
  let falseConditions = 0

  for (const [id, expected] of Object.entries(EXPECTED)) {
    const raw = readFileSync(join(KOK, "sources", "ilan", `${id}.txt`), "utf8")
    const { data } = await extractJobPosting(llm, raw)
    const conditions = data.requirements.filter((r) => r.type === "condition")
    const hits = expected.filter((e) => conditions.some((c) => c.text.toLowerCase().includes(e.toLowerCase())))
    const wrong = conditions.filter((c) => !expected.some((e) => c.text.toLowerCase().includes(e.toLowerCase())))
    caught += hits.length
    expectedTotal += expected.length
    falseConditions += wrong.length
    console.log(`  ${id.padEnd(8)} koşul ${hits.length}/${expected.length}` + (wrong.length ? ` · yanlış koşul: ${wrong.map((w) => w.text).join(" | ")}` : ""))
    const missed = expected.filter((e) => !hits.includes(e))
    if (missed.length) {
      const typed = missed.map((m) => data.requirements.find((r) => r.text.toLowerCase().includes(m.toLowerCase())))
      console.log(`           kaçan: ${missed.map((m, i) => `${m} → ${typed[i] ? typed[i]!.type : "çıkarılmadı"}`).join(", ")}`)
    }
  }
  console.log(`\nYakalanan koşul: ${caught}/${expectedTotal} · yanlış koşul: ${falseConditions}`)
}

void main()
