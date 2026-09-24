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
  const dosyalar = readdirSync(CV_DIR).filter((f) => f.endsWith(".txt")).sort()

  const satirlar: string[] = []
  for (const dosya of dosyalar) {
    const id = dosya.replace(/\.txt$/, "")
    const metin = readFileSync(join(CV_DIR, dosya), "utf8")

    for (const yontem of ["code", "llm"] as const) {
      const t = Date.now()
      const { data, tokens } = await extractResumeProfile(llm, metin, { segmenter: yontem })
      const sure = Math.round((Date.now() - t) / 1000)
      const maddeSayisi = data.experience.reduce((n, e) => n + e.bullets.length, 0)

      satirlar.push(
        `${id} · ${yontem.padEnd(4)} | beceri ${String(data.skills.length).padStart(2)} ` +
          `| deneyim ${data.experience.length} (${maddeSayisi} madde) ` +
          `| eğitim ${data.education.length} | dil ${data.languages.length} ` +
          `| ${String(sure).padStart(3)}s | ${String(tokens).padStart(4)} token`,
      )
      console.log(satirlar.at(-1))
      if (yontem === "code") console.log(`      beceriler: ${data.skills.slice(0, 14).join(", ")}`)
    }
    console.log("")
  }
}

void main()
