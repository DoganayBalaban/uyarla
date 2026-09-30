import { readFile } from "node:fs/promises"
import { ImageResponse } from "next/og"
import { fontPaths } from "@uyarla/fonts"

export const alt = "uyarla · Her ilana, doğru CV."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/**
 * Paylaşılan bağlantının önizlemesi. Font DejaVu Sans: ImageResponse'un
 * gömülü fontunda ş/ğ/ı yok, CV çıktısıyla aynı dosya kullanılıyor.
 */
export default async function OgGorseli() {
  const kalin = await readFile(fontPaths().bold)

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
          background: "#0f172a",
          color: "#f5f7ff",
          fontFamily: "DejaVu",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44 }}>
          {/* app/icon.svg ile aynı im. */}
          <svg width="60" height="60" viewBox="0 0 32 32">
            <rect x="7" y="5" width="16" height="21" rx="4" fill="#2b4eff" fillOpacity="0.5" transform="rotate(-12 15 15.5)" />
            <rect x="9" y="6" width="16" height="21" rx="4" fill="#2b4eff" />
          </svg>
          uyarla
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.1, letterSpacing: -2 }}>Her ilana, doğru CV.</div>
          <div style={{ fontSize: 32, color: "#94a3b8", lineHeight: 1.4 }}>
            İlanı yapıştır, uyumunu gör, CV'ni ilana göre uyarla. Deneyimini uydurmadan.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "DejaVu", data: kalin, weight: 700, style: "normal" }] },
  )
}
