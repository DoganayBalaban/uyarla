import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildAdaptationDraft, type Discard } from "../src/adapt/draft.js"
import { rescore } from "../src/adapt/rescore.js"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import {
  llmConfigFromEnv,
  type ExtractOptions,
  type ExtractResult,
  type LlmProvider,
} from "../src/llm/types.js"
import { resumeLanguage } from "../src/normalize/language.js"
import type { AdaptationDraft } from "../src/schemas/adaptation.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { collectEvidence } from "../src/score/evidence.js"
import { conceptTexts, score } from "../src/score/score.js"
import { onbellekDizini, type AdaptMetrics, type EvalPair } from "./types.js"

/**
 * Uyarlama değerlendirme koşusu (spec §12).
 *
 * Taslak üründeki `buildAdaptationDraft` ile üretiliyor: hedef seçimi,
 * yazım, terim uyumu doğrulaması, bilgi kaybı kontrolü ve atma kuralları
 * worker hattıyla birebir aynı. Önceki sürüm yazımları kendi yolundan
 * geçiriyordu ve ürünün attığı yazımları kabul sayıyordu (K-38).
 *
 * Ölçtüğü şeyler:
 *   1. Kaç madde yazıldı, kaçı önerildi, kaçı hangi kuralla atıldı
 *   2. Skor, iki okumayla:
 *      · madde — yalnızca önerilen maddeler onaylanırsa
 *      · tam   — maddeler, özet ve maddelerden eklenen beceriler
 *
 * Model yanıtları `cache/yazim-<çift>.json`'a istek özetine göre yazılıyor;
 * kural değiştiğinde ölçüm LLM'i tekrar çalıştırmadan tekrarlanabiliyor.
 * Hedef seçimi değişirse istek de değişir ve yalnızca o maddeler yeniden
 * yazılır.
 *
 * Kullanım:
 *   pnpm eval:adapt              önbellekten ölç, eksik yanıtları üret
 *   pnpm eval:adapt --refresh    bütün yanıtları yenile
 *   pnpm eval:adapt --ayrinti    atılan her yazımı gerekçesiyle göster
 */
const KOK = import.meta.dirname
const CACHE = onbellekDizini(KOK)
const PAIRS = join(KOK, "pairs")
const RUNS = join(KOK, "runs")

/** Yanıtları istek özetine göre saklayan sağlayıcı. */
class OnbellekliLlm implements LlmProvider {
  private readonly kayit: Record<string, ExtractResult<unknown>>
  yeniCagri = 0

  constructor(
    private readonly ic: LlmProvider,
    private readonly yol: string,
    tazele: boolean,
  ) {
    this.kayit =
      !tazele && existsSync(yol)
        ? (JSON.parse(readFileSync(yol, "utf8")) as Record<string, ExtractResult<unknown>>)
        : {}
  }

  async extract<T>(opts: ExtractOptions): Promise<ExtractResult<T>> {
    const anahtar = createHash("sha256")
      .update(`${opts.schemaName}\n${opts.prompt}\n${opts.input}`)
      .digest("hex")
    const kayitli = this.kayit[anahtar]
    if (kayitli) return kayitli as ExtractResult<T>
    const sonuc = await this.ic.extract<T>(opts)
    this.kayit[anahtar] = sonuc
    this.yeniCagri++
    return sonuc
  }

  kaydet() {
    if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true })
    writeFileSync(this.yol, JSON.stringify(this.kayit, null, 2))
  }
}

async function main() {
  const tazele = process.argv.includes("--refresh")
  const ayrinti = process.argv.includes("--ayrinti")
  const llmConfig = llmConfigFromEnv()
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())

  const dosyalar = readdirSync(PAIRS)
    .filter((f) => f.endsWith(".json"))
    .sort()
  console.log(
    `[eval:adapt] ${dosyalar.length} çift · model: ${llmConfig.model}` +
      `${tazele ? " · yanıtlar yenileniyor" : ""}\n`,
  )

  const metrics: AdaptMetrics[] = []

  for (const dosya of dosyalar) {
    const pair = JSON.parse(readFileSync(join(PAIRS, dosya), "utf8")) as EvalPair
    const basladi = Date.now()

    const profil = JSON.parse(
      readFileSync(join(CACHE, `cv-${pair.cv}.json`), "utf8"),
    ) as ResumeProfile
    const ilan = JSON.parse(
      readFileSync(join(CACHE, `ilan-${pair.ilan}.json`), "utf8"),
    ) as JobPostingData

    const kanitlar = collectEvidence(profil)
    const kanitMetinleri = kanitlar.map((k) => k.text)
    const vektorler = await embedding.embed([...kanitMetinleri, ...conceptTexts(ilan)])
    const sonuc = score({
      profile: profil,
      posting: ilan,
      evidence: kanitlar,
      evidenceVectors: vektorler.slice(0, kanitMetinleri.length),
      conceptVectors: vektorler.slice(kanitMetinleri.length),
    })

    const llm = new OnbellekliLlm(
      new LmStudioProvider(llmConfig),
      join(CACHE, `yazim-${pair.id}.json`),
      tazele,
    )
    const atilan: Record<string, number> = {}
    const atilanlar: Discard[] = []
    const { draft } = await buildAdaptationDraft({
      llm,
      embedding,
      profile: profil,
      posting: ilan,
      result: sonuc,
      onDiscard: (d) => {
        atilanlar.push(d)
        if (d.id !== "ozet") atilan[d.reason] = (atilan[d.reason] ?? 0) + 1
      },
    })
    llm.kaydet()

    const onerilen = draft.bullets.filter((b) => b.decision === "pending")
    // Kullanıcı önerilen her maddeyi onaylamış varsayılıyor: üst sınır bu,
    // ama her önerilen yazım doğrulamayı geçmiş olduğu için dürüst bir üst
    // sınır.
    const onayli: AdaptationDraft = {
      ...draft,
      bullets: draft.bullets.map((b) =>
        b.decision === "pending" ? { ...b, decision: "accepted" } : b,
      ),
    }
    const yalnizMaddeler: AdaptationDraft = {
      ...onayli,
      summary: { ...onayli.summary, decision: "rejected" },
      skillOrder: profil.skills,
      addedSkills: [],
    }

    const m: AdaptMetrics = {
      id: pair.id,
      bulletCount: draft.bullets.length,
      sameLanguage: resumeLanguage(profil) === ilan.language,
      rewrittenCount: onerilen.length + Object.values(atilan).reduce((t, n) => t + n, 0),
      proposedCount: onerilen.length,
      discarded: atilan,
      summaryAccepted:
        !!profil.summary &&
        draft.summary.decision === "accepted" &&
        draft.summary.rewritten !== profil.summary,
      addedSkills: draft.addedSkills ?? [],
      discards: atilanlar.map((d) => ({
        ...d,
        original: d.id === "ozet" ? (profil.summary ?? "") : (draft.bullets.find((b) => b.id === d.id)?.original ?? ""),
      })),
      scoreBefore: sonuc.score,
      scoreBullets: await rescore({ profile: profil, posting: ilan, draft: yalnizMaddeler }, embedding),
      scoreFull: await rescore({ profile: profil, posting: ilan, draft: onayli }, embedding),
      durationMs: Date.now() - basladi,
    }
    metrics.push(m)

    const atilanMetni = Object.entries(atilan)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ")
    console.log(
      `  ${pair.id.padEnd(16)} ${String(m.bulletCount).padStart(2)} madde · ` +
        (m.sameLanguage ? "" : "dil farklı · ") +
        `önerilen ${m.proposedCount}/${m.rewrittenCount}` +
        (atilanMetni ? ` (atılan: ${atilanMetni})` : "") +
        ` · özet ${m.summaryAccepted ? "✓" : "–"}` +
        ` · +${m.addedSkills.length} beceri` +
        ` · skor ${m.scoreBefore} → madde ${m.scoreBullets} → tam ${m.scoreFull}` +
        (llm.yeniCagri ? ` · yeni çağrı ${llm.yeniCagri}` : ""),
    )
    for (const d of m.discards) {
      console.log(`      ✗ ${d.id} ${d.reason}: ${d.detail}`)
      if (ayrinti) {
        console.log(`          önce : ${d.original}`)
        console.log(`          sonra: ${d.rewritten}`)
      }
    }
  }

  const topla = (f: (m: AdaptMetrics) => number) => metrics.reduce((t, m) => t + f(m), 0)
  const ort = (f: (m: AdaptMetrics) => number) => topla(f) / metrics.length
  const isaret = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}`
  const turler: Record<string, number> = {}
  for (const m of metrics) {
    for (const [k, v] of Object.entries(m.discarded)) turler[k] = (turler[k] ?? 0) + v
  }
  const yazilan = topla((m) => m.rewrittenCount)
  const onerilen = topla((m) => m.proposedCount)

  console.log(`\n  toplam madde          : ${topla((m) => m.bulletCount)}`)
  console.log(`  hedefle yazılan       : ${yazilan}`)
  console.log(
    `  önerilen              : ${onerilen}` +
      (yazilan ? ` (%${((onerilen / yazilan) * 100).toFixed(0)})` : ""),
  )
  console.log(`  atılan (nedene göre)  : ${JSON.stringify(turler)}`)
  console.log(`  özet kabul            : ${topla((m) => (m.summaryAccepted ? 1 : 0))}/${metrics.length}`)
  console.log(`  eklenen beceri        : ${topla((m) => m.addedSkills.length)}`)
  console.log(`  skor değişimi (madde) : ${isaret(ort((m) => m.scoreBullets - m.scoreBefore))}`)
  console.log(
    `  skor değişimi (tam)   : ${isaret(ort((m) => m.scoreFull - m.scoreBefore))}` +
      `  (artan ${metrics.filter((m) => m.scoreFull > m.scoreBefore).length}, ` +
      `düşen ${metrics.filter((m) => m.scoreFull < m.scoreBefore).length})`,
  )

  if (!existsSync(RUNS)) mkdirSync(RUNS, { recursive: true })
  const damga = new Date().toISOString().replace(/[:.]/g, "-")
  const cikti = join(RUNS, `uyarla-${damga}.json`)
  writeFileSync(
    cikti,
    JSON.stringify({ model: llmConfig.model, metrics, atilan: turler }, null, 2),
  )
  console.log(`\n  → runs/uyarla-${damga}.json`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
