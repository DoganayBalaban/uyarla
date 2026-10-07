import { readFile } from "node:fs/promises"
import { ImageResponse } from "next/og"
import { fontPaths } from "@uyarla/fonts"
import { LOGO_PATH, LOGO_VIEWBOX } from "@/components/brand/UyarlaMark"

export const alt = "uyarla · Her ilana, doğru CV."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/**
 * Paylaşılan bağlantının önizlemesi. Font DejaVu Sans: ImageResponse'un
 * gömülü fontunda ş/ğ/ı yok, CV çıktısıyla aynı dosya kullanılıyor.
 */
export default async function OgImage() {
  const boldFont = await readFile(fontPaths().bold)

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#111114",
          color: "#f5f7ff",
          fontFamily: "DejaVu",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* components/brand/UyarlaMark ile aynı logo; satori className desteklemiyor. */}
          <svg width="280" height="60" viewBox={LOGO_VIEWBOX} fill="#f5f7ff">
            <path fillRule="evenodd" d={LOGO_PATH} />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.1, letterSpacing: -2 }}>Her ilana, doğru CV.</div>
          <div style={{ fontSize: 32, color: "#94a3b8", lineHeight: 1.4 }}>
            İlanı yapıştır, uyumunu gör, CV'ni ilana göre uyarla. Deneyimini uydurmadan.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "DejaVu", data: boldFont, weight: 700, style: "normal" }] },
  )
}
