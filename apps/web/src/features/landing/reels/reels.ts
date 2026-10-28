import type { Phase } from "@/features/landing/demos/demoScript"

/**
 * TikTok deneyinin dikey videoları (DOG-162). Her video bir tanıtım
 * sahnesinin bir aralığını oynatıyor, açılış cümlesi üstte; sonda
 * kapanış kartı. Açılış cümleleri içerik planındaki tablonun aynısı;
 * 9 numara gerçek ürünün ekran kaydı olduğu için burada yok.
 */
export type Reel = {
  n: number
  /** İlk 2 saniyede okunan cümle; videonun başından sonuna üstte durur. */
  hook: string
  /** SCENE_LIST kimliği. */
  scene: string
  /** Sahnenin oynatılacak aralığı (aşama adları, ikisi de dahil); yoksa baştan sona. */
  from?: string
  to?: string
}

export const END_MS = 2500

export const REELS: Reel[] = [
  { n: 1, hook: "Elli ilana başvurup tek dönüş almadıysan, sorun deneyimin olmayabilir.", scene: "hero", from: "job", to: "score" },
  { n: 2, hook: "Yapay zekâ CV'ne hiç yapmadığın bir şeyi yazabilir.", scene: "kontrol" },
  { n: 3, hook: "Bu CV bu ilana 28 puan uyuyor. Aynı deneyimle 41.", scene: "hero" },
  { n: 4, hook: "LinkedIn başlığında unvanın yoksa işe alımcı seni bulamaz.", scene: "gorunur" },
  { n: 5, hook: "Mülakatta CV'nde olmayan bir sayı söylersen?", scene: "hazirlan" },
  { n: 6, hook: "“140 karakterde neden sen?” sorusunda takılıyorsan.", scene: "basvur" },
  { n: 7, hook: "LinkedIn'de yalnız “İstanbul” yazarsan yurt dışı ilanları çıkabilir.", scene: "bul" },
  { n: 8, hook: "Mülakattan sonra teşekkür notunu atlamıyor musun?", scene: "takip", from: "adapted" },
  { n: 10, hook: "Maddelerini ilanın diliyle yazınca skor nasıl değişir?", scene: "hero", from: "score", to: "hold" },
  { n: 11, hook: "Mülakat cevabın dağılıyorsa: STAR.", scene: "hazirlan", from: "answer" },
  { n: 12, hook: "“Başvur” demeden önce tek kontrol.", scene: "takip", to: "adapted" },
]

/** Sahnenin oynatılacak aralığı: başlangıç anı ve uzunluğu. */
export function reelSegment(phases: readonly Phase[], from?: string, to?: string): { start: number; length: number } {
  let t = 0
  let start = 0
  let end = 0
  const first = from ?? phases[0]!.id
  const last = to ?? phases.at(-1)!.id
  for (const p of phases) {
    if (p.id === first) start = t
    t += p.ms
    if (p.id === last) end = t
  }
  return { start, length: end - start }
}

/** Videonun `ms` anı: sahnenin hangi karesi, yoksa kapanış kartı (sahne son karesinde durur). */
export function reelFrame(seg: { start: number; length: number }, ms: number): { part: "scene" | "end"; sceneMs: number } {
  if (ms < seg.length) return { part: "scene", sceneMs: seg.start + ms }
  return { part: "end", sceneMs: seg.start + seg.length - 1 }
}
