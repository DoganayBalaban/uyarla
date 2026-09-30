import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { extractJobPosting } from "../src/extract/job.js"
import { extractResumeProfile } from "../src/extract/resume.js"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import {
  type ExtractOptions,
  type ExtractResult,
  type LlmProvider,
  llmConfigFromEnv,
} from "../src/llm/types.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { collectEvidence } from "../src/score/evidence.js"
import { conceptTexts, score } from "../src/score/score.js"
import { onbellekDizini } from "./types.js"

/**
 * Değerlendirme çiftlerini hazırlar ve incelenebilir bir rapor üretir.
 *
 * Çıkarım sonuçları `eval/cache/` altına yazılıyor ve varsa yeniden
 * kullanılıyor. Sebebi pratik: skor kuralları, eşikler ve normalleştirme sık
 * değişiyor ve her değişiklikte LLM'i baştan çalıştırmak on beş dakika
 * sürüyordu. Önbellekle saniyeler sürüyor.
 *
 * Çıkarımın kendisi değiştiğinde (prompt, şema, model) önbellek geçersizdir:
 *   pnpm eval:prepare --refresh
 */
const KOK = import.meta.dirname
const SOURCES = join(KOK, "sources")
const CACHE = onbellekDizini(KOK)
const RAPOR = join(KOK, "inceleme.md")

interface PairConfig {
  cv: string
  ilan: string
  beklenti: string
}

async function main() {
  const yenile = process.argv.includes("--refresh")
  const llm = new SayanLlm(new LmStudioProvider(llmConfigFromEnv()))
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())
  mkdirSync(CACHE, { recursive: true })

  const { pairs } = JSON.parse(
    readFileSync(join(SOURCES, "pairs.json"), "utf8"),
  ) as { pairs: PairConfig[] }

  const cvler = [...new Set(pairs.map((p) => p.cv))]
  const ilanlar = [...new Set(pairs.map((p) => p.ilan))]

  const profiller = new Map<string, ResumeProfile>()
  for (const id of cvler) {
    profiller.set(
      id,
      await onbellekli(`cv-${id}`, yenile, async () => {
        const metin = readFileSync(join(SOURCES, "cv", `${id}.txt`), "utf8")
        return (await extractResumeProfile(llm, metin)).data
      }, llm),
    )
  }

  const ilanVerileri = new Map<string, JobPostingData>()
  for (const id of ilanlar) {
    ilanVerileri.set(
      id,
      await onbellekli(`ilan-${id}`, yenile, async () => {
        const metin = readFileSync(join(SOURCES, "ilan", `${id}.txt`), "utf8")
        return (await extractJobPosting(llm, metin)).data
      }, llm),
    )
  }

  const satirlar: string[] = [
    "# Değerlendirme çiftleri · inceleme",
    "",
    "Her gereksinim için sistemin kararı ve gösterdiği kanıt aşağıda.",
    "Beklenti dosyalarını yazmadan önce bu liste elle gözden geçirilmeli:",
    "**sistemin kaçırdığı** ve **uydurduğu** eşleşmeler işaretlenmeli.",
    "",
  ]

  for (const cift of pairs) {
    const profil = profiller.get(cift.cv)!
    const ilan = ilanVerileri.get(cift.ilan)!

    const kanitlar = collectEvidence(profil)
    const kanitMetinleri = kanitlar.map((k) => k.text)
    const kavramMetinleri = conceptTexts(ilan)
    const vektorler = await embedding.embed([...kanitMetinleri, ...kavramMetinleri])

    const sonuc = score({
      profile: profil,
      posting: ilan,
      evidence: kanitlar,
      evidenceVectors: vektorler.slice(0, kanitMetinleri.length),
      conceptVectors: vektorler.slice(kanitMetinleri.length),
    })

    satirlar.push(
      `## ${cift.cv} × ${cift.ilan}`,
      "",
      `**Skor ${sonuc.score}** · beklenti: ${cift.beklenti} · ${ilan.position}`,
      `CV becerileri: ${profil.skills.join(", ") || "yok"}`,
      "",
      "| | Gereksinim | Önem | Karar | Yöntem | Kanıt |",
      "|---|---|---|---|---|---|",
    )
    for (const [i, r] of sonuc.requirements.entries()) {
      const kanit = r.evidence ? `${r.evidence.kind}: ${kisalt(r.evidence.text, 60)}` : "—"
      satirlar.push(
        `| ${i + 1} | ${kisalt(r.requirement.text, 70)} | ${r.requirement.importance} ` +
          `| ${r.status === "matched" ? "✓" : "✗"} | ${r.method ?? "—"} | ${kanit} |`,
      )
    }
    satirlar.push("", `Eksik kelimeler: ${sonuc.missingKeywords.join(", ") || "yok"}`, "")
    console.log(`${cift.cv} × ${cift.ilan}: skor ${sonuc.score} (${ilan.requirements.length} gereksinim)`)
  }

  // Yeni çıkarım yapıldıysa süre ve token kaydı; modelleri karşılaştırırken
  // hız ve maliyet buradan okunuyor.
  if (Object.keys(sureler).length > 0) {
    writeFileSync(join(CACHE, "sureler.json"), JSON.stringify(sureler, null, 2))
  }

  writeFileSync(RAPOR, satirlar.join("\n"))
  console.log(`\nİnceleme raporu: ${RAPOR}`)
}

/** Sağlayıcının harcadığı token'ları sayar. */
class SayanLlm implements LlmProvider {
  tokens = 0
  constructor(private readonly ic: LlmProvider) {}
  async extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>> {
    const sonuc = await this.ic.extract<T>(opts)
    this.tokens += sonuc.tokens
    return sonuc
  }
}

/** Çıkarım başına süre (sn) ve token; yalnızca bu koşuda yapılanlar. */
const sureler: Record<string, { saniye: number; tokens: number }> = {}

/** Sonucu diske yazar; varsa LLM'i hiç çağırmaz. */
async function onbellekli<T>(
  ad: string,
  yenile: boolean,
  uret: () => Promise<T>,
  llm?: SayanLlm,
): Promise<T> {
  const yol = join(CACHE, `${ad}.json`)
  if (!yenile && existsSync(yol)) {
    console.log(`  [önbellek] ${ad}`)
    return JSON.parse(readFileSync(yol, "utf8")) as T
  }
  const basladi = Date.now()
  const oncekiToken = llm?.tokens ?? 0
  const sonuc = await uret()
  writeFileSync(yol, JSON.stringify(sonuc, null, 2))
  const saniye = Math.round((Date.now() - basladi) / 100) / 10
  sureler[ad] = { saniye, tokens: (llm?.tokens ?? 0) - oncekiToken }
  console.log(`  [çıkarım] ${ad} (${saniye}s)`)
  return sonuc
}

function kisalt(metin: string, n: number): string {
  const tek = metin.replace(/\s+/g, " ").trim()
  return tek.length <= n ? tek : `${tek.slice(0, n - 1)}…`
}

void main()
