import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { extractResumeProfile } from "../src/extract/resume.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv } from "../src/llm/types.js"

/**
 * Kod bölümlemesi ile LLM bölümlemesini aynı CV'lerde karşılaştırır.
 * Ölçülen: çıkarılan beceri/deneyim/eğitim sayısı, süre ve token.
 */
const CV_DIR = join(import.meta.dirname, "sources", "cv")

async function main() {
  const llm = new LmStudioProvider(llmConfigFromEnv())
  const files = readdirSync(CV_DIR).filter((f) => f.endsWith(".txt")).sort()

  const rows: string[] = []
  for (const file of files) {
    const id = file.replace(/\.txt$/, "")
    const text = readFileSync(join(CV_DIR, file), "utf8")

    for (const approach of ["code", "llm"] as const) {
      const t = Date.now()
      const { data, tokens } = await extractResumeProfile(llm, text, { segmenter: approach })
      const duration = Math.round((Date.now() - t) / 1000)
      const bulletTotal = data.experience.reduce((n, e) => n + e.bullets.length, 0)

      rows.push(
        `${id} · ${approach.padEnd(4)} | beceri ${String(data.skills.length).padStart(2)} ` +
          `| deneyim ${data.experience.length} (${bulletTotal} madde) ` +
          `| eğitim ${data.education.length} | dil ${data.languages.length} ` +
          `| ${String(duration).padStart(3)}s | ${String(tokens).padStart(4)} token`,
      )
      console.log(rows.at(-1))
      if (approach === "code") console.log(`      beceriler: ${data.skills.slice(0, 14).join(", ")}`)
    }
    console.log("")
  }
}

void main()
