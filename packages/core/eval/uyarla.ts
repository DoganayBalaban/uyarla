import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { bulletId } from "../src/adapt/profile.js"
import { rescore } from "../src/adapt/rescore.js"
import { rewriteBullets } from "../src/adapt/rewrite.js"
import {
  OpenAiCompatibleEmbeddingProvider,
  embeddingConfigFromEnv,
} from "../src/llm/embedding.js"
import { LmStudioProvider } from "../src/llm/lmstudio.js"
import { llmConfigFromEnv } from "../src/llm/types.js"
import type { AdaptationDraft } from "../src/schemas/adaptation.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { collectEvidence } from "../src/score/evidence.js"
import { conceptTexts, score } from "../src/score/score.js"
import { DEFAULT_VERIFICATION_CONFIG, verifyRewrite } from "../src/verify/verify.js"
import type { AdaptMetrics, EvalPair } from "./types.js"

/**
 * Uyarlama değerlendirme koşusu (spec §12).
 *
 * Ölçtüğü üç şey:
 *   1. İşaretlenen madde oranı — uydurma kontrolü ne sıklıkla devreye giriyor
 *   2. Kontrol türü dağılımı — hangi kontrol ne yakalıyor
 *   3. Skor değişimi — uyarlama gerçekten eşleşme kazandırıyor mu
 *
 * Çıkarım `eval:prepare` önbelleğinden geliyor; bu betik yalnızca yeniden
 * yazma ve doğrulama yapıyor.
 *
 * Eşik `--esik=0.70` ile geçilebiliyor: tarama yapılabilsin diye (K-24'teki
 * yöntem). Sprint 1'in dersi — karar ölçümle verilir, sezgiyle değil.
 */
const KOK = import.meta.dirname
const CACHE = join(KOK, "cache")
const PAIRS = join(KOK, "pairs")
const RUNS = join(KOK, "runs")

function argDegeri(ad: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${ad}=`))?.split("=")[1]
}

async function main() {
  const esik = Number(argDegeri("esik") ?? DEFAULT_VERIFICATION_CONFIG.driftThreshold)
  const cfg = { driftThreshold: esik }

  const llmConfig = llmConfigFromEnv()
  const llm = new LmStudioProvider(llmConfig)
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())

  const dosyalar = readdirSync(PAIRS)
    .filter((f) => f.endsWith(".json"))
    .sort()
  console.log(
    `[eval:adapt] ${dosyalar.length} çift · model: ${llmConfig.model} · sapma eşiği: ${esik}\n`,
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

    const maddeler = profil.experience.flatMap((job, i) =>
      job.bullets.map((b, j) => ({
        id: bulletId(i, j),
        experienceIndex: i,
        original: b.text,
        sourceRef: b.sourceRef,
      })),
    )

    const yazimlar = await rewriteBullets(
      llm,
      maddeler.map((m) => m.original),
      ilan,
    )
    const yeniMetinler = maddeler.map((m, i) => yazimlar[i]?.data ?? m.original)

    // Tek toplu gömme: önce yeniden yazımlar, sonra kaynaklar (hattaki sıra).
    const vektorler = await embedding.embed([
      ...yeniMetinler,
      ...maddeler.map((m) => m.sourceRef),
    ])

    const byKind: Record<string, number> = {}
    let flaggedCount = 0

    const bullets = maddeler.map((madde, i) => {
      const dogrulama =
        yazimlar[i] === null
          ? { status: "ok" as const, issues: [] }
          : verifyRewrite(
              {
                rewritten: yeniMetinler[i]!,
                source: madde.sourceRef,
                posting: ilan,
                vectors: {
                  rewritten: vektorler[i]!,
                  source: vektorler[maddeler.length + i]!,
                },
              },
              cfg,
            )

      if (dogrulama.status === "flagged") flaggedCount++
      for (const sorun of dogrulama.issues) {
        byKind[sorun.kind] = (byKind[sorun.kind] ?? 0) + 1
      }

      return {
        ...madde,
        rewritten: yeniMetinler[i]!,
        verification: dogrulama,
        // Ölçüm için hepsi kabul: uyarlamanın ÜST SINIR kazancını görüyoruz.
        // Gerçek kullanımda kullanıcı işaretlilerin bir kısmını reddedecek.
        decision: "accepted" as const,
      }
    })

    const taslak: AdaptationDraft = {
      summary: {
        original: profil.summary,
        rewritten: profil.summary ?? "",
        verification: { status: "ok", issues: [] },
        // Özet ölçüme girmiyor: bu koşu madde yeniden yazımının kazancını
        // ölçüyor ve özeti karıştırmak iki etkiyi ayırt edilemez kılardı.
        decision: "rejected",
      },
      bullets,
      skillOrder: profil.skills,
    }

    const kanitlar = collectEvidence(profil)
    const kanitMetinleri = kanitlar.map((k) => k.text)
    const oncekiVektorler = await embedding.embed([
      ...kanitMetinleri,
      ...conceptTexts(ilan),
    ])
    const onceki = score({
      profile: profil,
      posting: ilan,
      evidence: kanitlar,
      evidenceVectors: oncekiVektorler.slice(0, kanitMetinleri.length),
      conceptVectors: oncekiVektorler.slice(kanitMetinleri.length),
    }).score

    const sonraki = await rescore({ profile: profil, posting: ilan, draft: taslak }, embedding)

    const m: AdaptMetrics = {
      id: pair.id,
      bulletCount: maddeler.length,
      flaggedCount,
      byKind,
      scoreBefore: onceki,
      scoreAfter: sonraki,
      durationMs: Date.now() - basladi,
      failedCount: yazimlar.filter((y) => y === null).length,
      unchangedCount: maddeler.filter((m, i) => m.original === yeniMetinler[i]).length,
    }
    metrics.push(m)

    console.log(
      `  ${pair.id.padEnd(30)} ${String(m.bulletCount).padStart(2)} madde · ` +
        `işaretli ${m.flaggedCount} · skor ${m.scoreBefore}→${m.scoreAfter} · ` +
        `${Math.round(m.durationMs / 1000)}s` +
        (m.failedCount ? ` · patlayan ${m.failedCount}` : "") +
        (m.unchangedCount ? ` · değişmeyen ${m.unchangedCount}` : ""),
    )
  }

  const toplamMadde = metrics.reduce((t, m) => t + m.bulletCount, 0)
  const toplamIsaretli = metrics.reduce((t, m) => t + m.flaggedCount, 0)
  const turler: Record<string, number> = {}
  for (const m of metrics) {
    for (const [k, v] of Object.entries(m.byKind)) turler[k] = (turler[k] ?? 0) + v
  }
  const degisimler = metrics.map((m) => m.scoreAfter - m.scoreBefore)
  const ortalamaDegisim = degisimler.reduce((t, d) => t + d, 0) / metrics.length

  console.log(`\n  sapma eşiği           : ${esik}`)
  console.log(`  toplam madde          : ${toplamMadde}`)
  console.log(
    `  işaretlenen oranı     : %${((toplamIsaretli / toplamMadde) * 100).toFixed(1)} ` +
      `(${toplamIsaretli}/${toplamMadde})`,
  )
  console.log(`  kontrol dağılımı      : ${JSON.stringify(turler)}`)
  console.log(
    `  ortalama skor değişimi: ${ortalamaDegisim >= 0 ? "+" : ""}${ortalamaDegisim.toFixed(1)}` +
      `  (artan ${degisimler.filter((d) => d > 0).length}, ` +
      `sabit ${degisimler.filter((d) => d === 0).length}, ` +
      `düşen ${degisimler.filter((d) => d < 0).length})`,
  )
  console.log(`  değişmeyen madde      : ${metrics.reduce((t, m) => t + m.unchangedCount, 0)}`)
  console.log(`  patlayan madde        : ${metrics.reduce((t, m) => t + m.failedCount, 0)}`)

  if (!existsSync(RUNS)) mkdirSync(RUNS, { recursive: true })
  const dosya = join(RUNS, `uyarla-esik${esik}-${Date.now()}.json`)
  writeFileSync(
    dosya,
    JSON.stringify({ model: llmConfig.model, esik, metrics, turler, ortalamaDegisim }, null, 2),
  )
  console.log(`\n  → ${dosya}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
