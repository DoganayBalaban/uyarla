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
  /** Açılış cümlesinin okunuşu, ekrandakinden farklıysa (TTS rakamları yanlış okuyor: sayılar yazıyla). */
  hookSpoken?: string
  /** SCENE_LIST kimliği. */
  scene: string
  /** Sahnenin oynatılacak aralığı (aşama adları, ikisi de dahil); yoksa baştan sona. */
  from?: string
  to?: string
  /**
   * Seslendirme, cümle cümle (Kizagan TTS cümle cümle daha iyi okuyor). İlk
   * cümle ekrandaki açılış cümlesi; sondaki çağrı (VOICE_CTA) her videoda aynı.
   */
  voice: string[]
}

/** Kapanış kartıyla birlikte okunan çağrı; adres harf harf okunsun diye yazıyla. */
export const VOICE_CTA = "Skorunu ücretsiz gör: uyarla nokta com nokta te re."

export const END_MS = 2500

export const REELS: Reel[] = [
  { n: 1, hook: "Elli ilana başvurup tek dönüş almadıysan, sorun deneyimin olmayabilir.", scene: "hero", from: "job", to: "score", voice: ["Elli ilana başvurup tek dönüş almadıysan, sorun deneyimin olmayabilir.", "Birçok şirket CV'leri önce bir yazılımla süzer.", "uyarla, ilanın aradığı her şeyi CV'nde arar ve eksik kalanı açıkça gösterir."] },
  { n: 2, hook: "Yapay zekâ CV'ne hiç yapmadığın bir şeyi yazabilir.", scene: "kontrol", voice: ["Yapay zekâ CV'ne hiç yapmadığın bir şeyi yazabilir.", "uyarla, yeniden yazılan her maddeyi kontrol eder.", "Orijinalinde olmayan bir iddia varsa işaretler ve kararı sana bırakır.", "Karar vermeden CV'ni indiremezsin."] },
  { n: 3, hook: "Bu CV bu ilana 28 puan uyuyor. Aynı deneyimle 41.", scene: "hero", hookSpoken: "Bu CV bu ilana yirmi sekiz puan uyuyor. Aynı deneyimle kırk bir.", voice: ["Bu CV bu ilana yirmi sekiz puan uyuyor. Aynı deneyimle kırk bir.", "uyarla, maddelerini ilanın diliyle yeniden yazar; eskisi üstü çizili, yenisi yeşil görünür.", "Olmayan bir şeyi eklemez."] },
  { n: 4, hook: "LinkedIn başlığında unvanın yoksa işe alımcı seni bulamaz.", scene: "gorunur", voice: ["LinkedIn başlığında unvanın yoksa işe alımcı seni bulamaz.", "uyarla profilini hedef rolüne göre denetler.", "Başlığını unvanın ve öne çıkan becerilerinle yeniden yazar; her parçanın kaynağını gösterir."] },
  { n: 5, hook: "Mülakatta CV'nde olmayan bir sayı söylersen?", scene: "hazirlan", voice: ["Mülakatta CV'nde olmayan bir sayı söylersen?", "uyarla'nın yazılı pratiğinde cevabını yazarsın.", "Bir iddia CV'nde geçmiyorsa, kâğıtta yok diye işaretlenir.", "Ya CV'ne ekle, ya cevaptan çıkar."] },
  { n: 6, hook: "“140 karakterde neden sen?” sorusunda takılıyorsan.", scene: "basvur", hookSpoken: "Yüz kırk karakterde neden sen, sorusunda takılıyorsan.", voice: ["Yüz kırk karakterde neden sen, sorusunda takılıyorsan.", "uyarla cevabı gönderdiğin CV'deki cümlelerden yazar; karakter sınırını kod denetler.", "Kopyalarsın, forma sen yapıştırırsın."] },
  { n: 7, hook: "LinkedIn'de yalnız “İstanbul” yazarsan yurt dışı ilanları çıkabilir.", scene: "bul", voice: ["LinkedIn'de yalnız “İstanbul” yazarsan yurt dışı ilanları çıkabilir.", "Doğrusu: İstanbul, Türkiye.", "uyarla, hedef rolünle dört sitenin aramasını doğru sorguyla açar."] },
  { n: 8, hook: "Mülakattan sonra teşekkür notunu atlıyor musun?", scene: "takip", from: "adapted", voice: ["Mülakattan sonra teşekkür notunu atlıyor musun?", "uyarla, başvuru kartın mülakata geçince taslağı hazırlar.", "Alıcının adını uydurmaz; o kısmı sana bırakır."] },
  { n: 10, hook: "Maddelerini ilanın diliyle yazınca skor nasıl değişir?", scene: "hero", from: "score", to: "hold", voice: ["Maddelerini ilanın diliyle yazınca skor nasıl değişir?", "uyarla, ilanın terimini deneyimine dayanarak ekler ve kaynağını gösterir.", "Bu örnekte skor yirmi sekizden kırk bire çıkıyor."] },
  { n: 11, hook: "Mülakat cevabın dağılıyorsa: STAR.", scene: "hazirlan", from: "answer", voice: ["Mülakat cevabın dağılıyorsa: STAR.", "Durum, görev, eylem, sonuç.", "uyarla'nın pratiğinde cevabını yazarsın; eksik kalan adımı gösterir. Bu cevapta sonuç eksik."] },
  { n: 12, hook: "“Başvur” demeden önce tek kontrol.", scene: "takip", to: "adapted", voice: ["“Başvur” demeden önce tek kontrol.", "Zorunlu bir gereksinim CV'nde görünmüyorsa uyarla seni uyarır.", "Önce uyarlayabilir ya da yine de başvurabilirsin."] },
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

/**
 * Videonun `ms` anı: sahnenin hangi karesi, yoksa kapanış kartı. `body` =
 * kapanış kartına kadar geçen süre (seslendirmenin çağrıya kadarki kısmı);
 * sahne bu süreye yayılıyor, verilmezse kendi hızında.
 */
export function reelFrame(
  seg: { start: number; length: number },
  ms: number,
  body: number = seg.length,
): { part: "scene" | "end"; sceneMs: number } {
  if (ms < body) return { part: "scene", sceneMs: seg.start + Math.min(seg.length - 1, Math.floor((ms * seg.length) / body)) }
  return { part: "end", sceneMs: seg.start + seg.length - 1 }
}
