/**
 * Sayfa düğmesinin çıktığı iş siteleri (DOG-169). Eklenti bu sitelerde
 * kendiliğinden çalışıyor; kurulumda Chrome bunlar için "verilerinizi
 * okuyabilir" iznini gösteriyor. Liste kısa tutuluyor: yalnızca iş siteleri.
 * Diğer sitelerde simge ve sağ tık (activeTab) yolu var.
 *
 * manifest.json'daki `content_scripts.matches` bu listeyle aynı olmalı (test).
 */
export const BUTTON_SITES = [
  "linkedin.com",
  "kariyer.net",
  "yenibiris.com",
  "secretcv.com",
  "eleman.net",
  "tr.indeed.com",
  "greenhouse.io",
  "lever.co",
  "myworkdayjobs.com",
] as const

/** Manifest kalıpları: alan adının kendisi ve alt alan adları. */
export function buttonSiteMatches(): string[] {
  return BUTTON_SITES.flatMap((d) => [`https://${d}/*`, `https://*.${d}/*`])
}

export function isButtonSite(host: string): boolean {
  const h = host.toLowerCase()
  return BUTTON_SITES.some((d) => h === d || h.endsWith(`.${d}`))
}
