import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { authErrorResponse } from "@/server/authz"
import { extractPostingText, isAllowedPath } from "@/server/jobPostingFromUrl"
import { enforceRateLimit, redisStore } from "@/server/rateLimit"

export const runtime = "nodejs"

const TIMEOUT_MS = 10_000
const MAX_BYTES = 3 * 1024 * 1024
const MAX_REDIRECTS = 3

/** Her sayfa bir dış istek; kötüye kullanıma karşı IP başına sınır. */
const LIMIT = { limit: 20, windowSeconds: 3600 }

const UNSUPPORTED =
  "Bu siteden ilanı okuyamıyoruz. Kariyer.net, LinkedIn, Secretcv, Yenibiris, Eleman.net, Indeed ve şirketlerin Greenhouse, Lever, Workable, Workday ilan sayfaları destekleniyor. Diğerleri için ilan metnini kopyalayıp yapıştırabilirsin."

/**
 * İlan bağlantısını indirip ilan metnini döndürür. Analiz formu metni
 * kutuya dolduruyor; kullanıcı düzenleyip gönderiyor — analiz akışı
 * değişmiyor, yalnızca kopyala-yapıştır adımı kısalıyor.
 */
export async function POST(request: Request) {
  try {
    const { url: raw } = (await request.json().catch(() => ({}))) as { url?: unknown }
    if (typeof raw !== "string" || !raw.trim()) {
      return NextResponse.json({ error: "İlan bağlantısını yapıştır." }, { status: 400 })
    }

    let url = isAllowedPath(raw)
    if (!url) return NextResponse.json({ error: UNSUPPORTED, code: "unsupported" }, { status: 400 })

    const requestHeaders = await headers()
    const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || "bilinmiyor"
    await enforceRateLimit(redisStore, `ilanurl:${ip}`, LIMIT)

    // Yönlendirmeler elle takip ediliyor: her adım izin listesine karşı
    // yeniden kontrol edilmeli, yoksa izinli bir sitedeki açık yönlendirme
    // isteği iç ağa taşıyabilir.
    let response: Response | null = null
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
        },
      })
      const dropTarget = response.status >= 300 && response.status < 400 ? response.headers.get("location") : null
      if (!dropTarget) break
      const next = isAllowedPath(new URL(dropTarget, url).toString())
      if (!next) {
        return NextResponse.json({ error: UNSUPPORTED, code: "unsupported" }, { status: 400 })
      }
      url = next
      response = null
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        {
          error:
            "İlan sayfasını açamadık. Site erişimi engellemiş ya da ilan kaldırılmış olabilir. İlan metnini kopyalayıp yapıştırır mısın?",
          code: "fetch_failed",
        },
        { status: 502 },
      )
    }

    const size = Number(response.headers.get("content-length") ?? 0)
    if (size > MAX_BYTES) {
      return NextResponse.json({ error: "Sayfa çok büyük.", code: "too_large" }, { status: 502 })
    }
    const html = (await response.text()).slice(0, MAX_BYTES)

    const posting = extractPostingText(html, url.hostname)
    if (!posting) {
      return NextResponse.json(
        {
          error:
            "Sayfada ilan metnini bulamadık. Site giriş istiyor olabilir; ilan metnini kopyalayıp yapıştırır mısın?",
          code: "no_text",
        },
        { status: 422 },
      )
    }

    return NextResponse.json(posting)
  } catch (error) {
    const reply = authErrorResponse(error)
    if (reply) return reply
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return NextResponse.json(
        { error: "İlan sayfası çok geç cevap verdi. Metni kopyalayıp yapıştırır mısın?", code: "timeout" },
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
