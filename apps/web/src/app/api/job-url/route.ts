import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { authErrorResponse } from "@/server/authz"
import { extractPostingText, isAllowedPath } from "@/server/jobPostingFromUrl"
import { enforceRateLimit, redisStore } from "@/server/rateLimit"

export const runtime = "nodejs"

const ZAMAN_ASIMI_MS = 10_000
const EN_FAZLA_BAYT = 3 * 1024 * 1024
const EN_FAZLA_YONLENDIRME = 3

/** Her sayfa bir dış istek; kötüye kullanıma karşı IP başına sınır. */
const LIMIT = { limit: 20, windowSeconds: 3600 }

const DESTEKLENMIYOR =
  "Bu siteden ilanı okuyamıyoruz. Kariyer.net, LinkedIn, Secretcv, Yenibiris, Eleman.net, Indeed ve şirketlerin Greenhouse, Lever, Workable, Workday ilan sayfaları destekleniyor. Diğerleri için ilan metnini kopyalayıp yapıştırabilirsin."

/**
 * İlan bağlantısını indirip ilan metnini döndürür. Analiz formu metni
 * kutuya dolduruyor; kullanıcı düzenleyip gönderiyor — analiz akışı
 * değişmiyor, yalnızca kopyala-yapıştır adımı kısalıyor.
 */
export async function POST(request: Request) {
  try {
    const { url: ham } = (await request.json().catch(() => ({}))) as { url?: unknown }
    if (typeof ham !== "string" || !ham.trim()) {
      return NextResponse.json({ error: "İlan bağlantısını yapıştır." }, { status: 400 })
    }

    let url = isAllowedPath(ham)
    if (!url) return NextResponse.json({ error: DESTEKLENMIYOR, code: "desteklenmiyor" }, { status: 400 })

    const basliklar = await headers()
    const ip = basliklar.get("x-forwarded-for")?.split(",")[0]?.trim() || basliklar.get("x-real-ip") || "bilinmiyor"
    await enforceRateLimit(redisStore, `ilanurl:${ip}`, LIMIT)

    // Yönlendirmeler elle takip ediliyor: her adım izin listesine karşı
    // yeniden kontrol edilmeli, yoksa izinli bir sitedeki açık yönlendirme
    // isteği iç ağa taşıyabilir.
    let cevap: Response | null = null
    for (let i = 0; i <= EN_FAZLA_YONLENDIRME; i++) {
      cevap = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
        },
      })
      const hedef = cevap.status >= 300 && cevap.status < 400 ? cevap.headers.get("location") : null
      if (!hedef) break
      const sonraki = isAllowedPath(new URL(hedef, url).toString())
      if (!sonraki) {
        return NextResponse.json({ error: DESTEKLENMIYOR, code: "desteklenmiyor" }, { status: 400 })
      }
      url = sonraki
      cevap = null
    }

    if (!cevap || !cevap.ok) {
      return NextResponse.json(
        {
          error:
            "İlan sayfasını açamadık. Site erişimi engellemiş ya da ilan kaldırılmış olabilir. İlan metnini kopyalayıp yapıştırır mısın?",
          code: "indirilemedi",
        },
        { status: 502 },
      )
    }

    const boyut = Number(cevap.headers.get("content-length") ?? 0)
    if (boyut > EN_FAZLA_BAYT) {
      return NextResponse.json({ error: "Sayfa çok büyük.", code: "cok_buyuk" }, { status: 502 })
    }
    const html = (await cevap.text()).slice(0, EN_FAZLA_BAYT)

    const ilan = extractPostingText(html, url.hostname)
    if (!ilan) {
      return NextResponse.json(
        {
          error:
            "Sayfada ilan metnini bulamadık. Site giriş istiyor olabilir; ilan metnini kopyalayıp yapıştırır mısın?",
          code: "metin_yok",
        },
        { status: 422 },
      )
    }

    return NextResponse.json(ilan)
  } catch (error) {
    const yanit = authErrorResponse(error)
    if (yanit) return yanit
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return NextResponse.json(
        { error: "İlan sayfası çok geç cevap verdi. Metni kopyalayıp yapıştırır mısın?", code: "zaman_asimi" },
        { status: 504 },
      )
    }
    console.error("[api/job-url]", error)
    return NextResponse.json(
      { error: "İlanı alamadık. Metni kopyalayıp yapıştırır mısın?", code: "unknown" },
      { status: 500 },
    )
  }
}
