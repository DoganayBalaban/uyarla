import { loadFont } from "@remotion/google-fonts/Geist"
import { MotionGlobalConfig } from "motion/react"
import { Composition } from "remotion"
import { Tanitim } from "./Tanitim"
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from "./timing"

// Sahnelerdeki motion geçişleri anında bitsin: kare yalnızca zamandan çiziliyor.
MotionGlobalConfig.skipAnimations = true

// Web'de next/font <html>'e --font-geist koyuyor; burada aynı değişken.
const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] })
document.documentElement.style.setProperty("--font-geist", fontFamily)

export function Root() {
  return <Composition id="Tanitim" component={Tanitim} durationInFrames={TOTAL_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
}
