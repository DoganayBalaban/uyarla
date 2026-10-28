/**
 * Tanıtım sahnelerinin örnek verisi (DOG-160). Elif kurgusal; hero ve
 * gereksinim demolarındaki kişiyle aynı. Kural (K-32, spec §6): sahnelerde
 * gösterilen her kanıt bu CV'de birebir geçiyor, "kâğıtta yok" diye
 * işaretlenen hiçbir ifade geçmiyor. scenes.test.ts bunu denetliyor.
 */

export const SCENE_COMPANY = "Kuzey Yazılım"
export const SCENE_ROLE = "Frontend Geliştirici"
export const SCENE_CITY = "İstanbul"

export const ELIF_CV = [
  "Elif Yılmaz",
  "Yazılım Geliştirici",
  "Deneyim",
  "Müşteri paneli projesinde React kullandım.",
  "Kod incelemelerine katıldım ve yeni gelen geliştiricilere yardımcı oldum.",
  "Bileşenler için Jest ile birim testleri yazdım.",
  "Stajyerlerin uyumuna destek oldum.",
  "Beceriler",
  "React, TypeScript, JavaScript, HTML, CSS, Git",
].join("\n")

/** Alıntı CV'de birebir geçiyor mu. */
export function inCv(quote: string): boolean {
  return ELIF_CV.includes(quote)
}
