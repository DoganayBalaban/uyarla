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
import type { AdaptationDraft, AdaptedBullet } from "../src/schemas/adaptation.js"
import type { JobPostingData } from "../src/schemas/job.js"
import type { ResumeProfile } from "../src/schemas/resume.js"
import { collectEvidence } from "../src/score/evidence.js"
import { conceptTexts, score } from "../src/score/score.js"
import { DEFAULT_VERIFICATION_CONFIG, verifyRewrite } from "../src/verify/verify.js"
import type { AdaptMetrics, EvalPair } from "./types.js"

/**
 * Uyarlama değerlendirme koşusu (spec §12).
 *
 * Ölçtüğü şeyler:
 *   1. İşaretlenen madde oranı — uydurma kontrolü ne sıklıkla devreye giriyor
 *   2. Kontrol türü dağılımı — hangi kontrol ne yakalıyor
 *   3. Skor değişimi, iki ayrı okumayla:
 *      · üst sınır — bütün yeniden yazımlar kabul edilseydi
 *      · dürüst    — yalnızca doğrulamayı geçenler kabul edilseydi
 *
 * İkinci okuma şart: ilk koşuda bir çift 0'dan 33'e çıktı ama 8 maddenin 6'sı
 * işaretliydi. Yani kazancın büyük kısmı, kullanıcının reddedeceği uydurma
 * içerikten geliyordu. Tek başına üst sınır ürünü olduğundan iyi gösterir.
 *
 * Yeniden yazımlar `cache/uyarlama-<çift>.json`'a yazılıyor. Eşik taraması
 * böylece LLM'i tekrar çalıştırmadan saniyeler sürüyor — Sprint 1'deki
 * `eval:prepare` ile aynı gerekçe.
 *
 * Kullanım:
 *   pnpm eval:adapt                  önbellekten ölç
 *   pnpm eval:adapt --refresh        yeniden yazımları yenile
 *   pnpm eval:adapt --esik=0.70      eşiği değiştirip ölç
 */
const KOK = import.meta.dirname
const CACHE = join(KOK, "cache")
const PAIRS = join(KOK, "pairs")
const RUNS = join(KOK, "runs")

interface YazimOnbellegi {
  bullets: Array<{
    id: string
    experienceIndex: number
    original: string
    sourceRef: string
    rewritten: string
    /** Yeniden yazım çağrısı patladı mı (spec §13). */
    failed: boolean
  }>
}

function argDegeri(ad: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${ad}=`))?.split("=")[1]
}

/** Yeniden yazımları üretir ya da önbellekten okur. */
async function yazimlariAl(
  pair: EvalPair,
  profil: ResumeProfile,
  ilan: JobPostingData,
  tazele: boolean,
): Promise<YazimOnbellegi> {
  const yol = join(CACHE, `uyarlama-${pair.id}.json`)
  if (!tazele && existsSync(yol)) {
    return JSON.parse(readFileSync(yol, "utf8")) as YazimOnbellegi
  }

  const llm = new LmStudioProvider(llmConfigFromEnv())
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

  const onbellek: YazimOnbellegi = {
    bullets: maddeler.map((m, i) => ({
      ...m,
      rewritten: yazimlar[i]?.data ?? m.original,
      failed: yazimlar[i] === null,
    })),
  }

  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true })
  writeFileSync(yol, JSON.stringify(onbellek, null, 2))
  return onbellek
}

async function main() {
  const esik = Number(argDegeri("esik") ?? DEFAULT_VERIFICATION_CONFIG.driftThreshold)
  const cfg = { driftThreshold: esik }
  const tazele = process.argv.includes("--refresh")

  const llmConfig = llmConfigFromEnv()
  const embedding = new OpenAiCompatibleEmbeddingProvider(embeddingConfigFromEnv())

  const dosyalar = readdirSync(PAIRS)
    .filter((f) => f.endsWith(".json"))
    .sort()
  console.log(
    `[eval:adapt] ${dosyalar.length} çift · model: ${llmConfig.model} · ` +
      `sapma eşiği: ${esik}${tazele ? " · yeniden yazımlar yenileniyor" : ""}\n`,
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

    const { bullets: yazimlar } = await yazimlariAl(pair, profil, ilan, tazele)

    // Tek toplu gömme: önce yeniden yazımlar, sonra kaynaklar (hattaki sıra).
    const vektorler = await embedding.embed([
      ...yazimlar.map((y) => y.rewritten),
      ...yazimlar.map((y) => y.sourceRef),
    ])

    const byKind: Record<string, number> = {}
    let flaggedCount = 0

    const dogrulanmis = yazimlar.map((y, i) => {
      // Patlayan madde orijinal hâliyle kalıyor ve doğrulamaya sokulmuyor:
      // kullanıcının kendi cümlesini uyarmak anlamsız (spec §13).
      const verification = y.failed
        ? { status: "ok" as const, issues: [] }
        : verifyRewrite(
            {
              rewritten: y.rewritten,
              source: y.sourceRef,
              posting: ilan,
              vectors: {
                rewritten: vektorler[i]!,
                source: vektorler[yazimlar.length + i]!,
              },
            },
            cfg,
          )

      if (verification.status === "flagged") flaggedCount++
      for (const sorun of verification.issues) {
        byKind[sorun.kind] = (byKind[sorun.kind] ?? 0) + 1
      }
      return { ...y, verification }
    })

    /** Özet ölçüme girmiyor: bu koşu madde yeniden yazımının kazancını ölçüyor. */
    const taslakYap = (kabul: (v: { status: string }) => boolean): AdaptationDraft => ({
      summary: {
        original: profil.summary,
        rewritten: profil.summary ?? "",
        verification: { status: "ok", issues: [] },
        decision: "rejected",
      },
      bullets: dogrulanmis.map(
        (d): AdaptedBullet => ({
          id: d.id,
          experienceIndex: d.experienceIndex,
          original: d.original,
          sourceRef: d.sourceRef,
          rewritten: d.rewritten,
          verification: d.verification,
          decision: kabul(d.verification) ? "accepted" : "rejected",
        }),
      ),
      skillOrder: profil.skills,
    })

    const kanitlar = collectEvidence(profil)
    const kanitMetinleri = kanitlar.map((k) => k.text)
    const oncekiVektorler = await embedding.embed([...kanitMetinleri, ...conceptTexts(ilan)])
    const onceki = score({
      profile: profil,
      posting: ilan,
      evidence: kanitlar,
      evidenceVectors: oncekiVektorler.slice(0, kanitMetinleri.length),
      conceptVectors: oncekiVektorler.slice(kanitMetinleri.length),
    }).score

    // Üst sınır: hepsi kabul. Dürüst: yalnızca doğrulamayı geçenler.
    const ustSinir = await rescore(
      { profile: profil, posting: ilan, draft: taslakYap(() => true) },
      embedding,
    )
    const durust = await rescore(
      { profile: profil, posting: ilan, draft: taslakYap((v) => v.status === "ok") },
      embedding,
    )

    const m: AdaptMetrics = {
      id: pair.id,
      bulletCount: yazimlar.length,
      flaggedCount,
      byKind,
      scoreBefore: onceki,
      scoreAfter: ustSinir,
      scoreAfterCleanOnly: durust,
      durationMs: Date.now() - basladi,
      failedCount: yazimlar.filter((y) => y.failed).length,
      unchangedCount: yazimlar.filter((y) => y.original === y.rewritten).length,
    }
    metrics.push(m)

    console.log(
      `  ${pair.id.padEnd(16)} ${String(m.bulletCount).padStart(2)} madde · ` +
        `işaretli ${m.flaggedCount} · ` +
        `skor ${m.scoreBefore}→${m.scoreAfterCleanOnly} (üst sınır ${m.scoreAfter})` +
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
  const ort = (f: (m: AdaptMetrics) => number) =>
    metrics.reduce((t, m) => t + f(m), 0) / metrics.length
  const durustDegisim = ort((m) => m.scoreAfterCleanOnly - m.scoreBefore)
  const ustDegisim = ort((m) => m.scoreAfter - m.scoreBefore)
  const artan = metrics.filter((m) => m.scoreAfterCleanOnly > m.scoreBefore).length
  const dusen = metrics.filter((m) => m.scoreAfterCleanOnly < m.scoreBefore).length

  console.log(`\n  sapma eşiği           : ${esik}`)
  console.log(`  toplam madde          : ${toplamMadde}`)
  console.log(
    `  işaretlenen oranı     : %${((toplamIsaretli / toplamMadde) * 100).toFixed(1)} ` +
      `(${toplamIsaretli}/${toplamMadde})`,
  )
  console.log(`  kontrol dağılımı      : ${JSON.stringify(turler)}`)
  console.log(
    `  skor değişimi (dürüst): ${durustDegisim >= 0 ? "+" : ""}${durustDegisim.toFixed(1)}` +
      `  (artan ${artan}, sabit ${metrics.length - artan - dusen}, düşen ${dusen})`,
  )
  console.log(
    `  skor değişimi (üst)   : ${ustDegisim >= 0 ? "+" : ""}${ustDegisim.toFixed(1)}` +
      `  ← uydurma dahil; ürünün vaadi değil`,
  )
  console.log(`  değişmeyen madde      : ${metrics.reduce((t, m) => t + m.unchangedCount, 0)}`)
  console.log(`  patlayan madde        : ${metrics.reduce((t, m) => t + m.failedCount, 0)}`)

  if (!existsSync(RUNS)) mkdirSync(RUNS, { recursive: true })
  const dosya = join(RUNS, `uyarla-esik${esik}.json`)
  writeFileSync(
    dosya,
    JSON.stringify(
      { model: llmConfig.model, esik, metrics, turler, durustDegisim, ustDegisim },
      null,
      2,
    ),
  )
  console.log(`\n  → ${dosya}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
