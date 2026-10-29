import path from "node:path"
import { Config } from "@remotion/cli/config"
import { enableTailwind } from "@remotion/tailwind-v4"

// Sahneler apps/web'den: "@/…" yolu web'in src'sine; Tailwind v4 web'in globals.css'iyle.
Config.overrideWebpackConfig((config) =>
  enableTailwind({
    ...config,
    resolve: {
      ...config.resolve,
      alias: { ...(config.resolve?.alias ?? {}), "@": path.resolve(process.cwd(), "../web/src") },
    },
  }),
)
Config.setVideoImageFormat("jpeg")
Config.setJpegQuality(92)
// Remotion'ın indirdiği headless shell bazı makinelerde kök bileşeni hiç
// yüklemiyor (rAF tetiklenmiyor); öyleyse Playwright'ınkini ver.
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER)
