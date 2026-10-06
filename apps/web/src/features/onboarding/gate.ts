import { DEFAULT_RETURN_PATH, loginPath, safeReturnPath } from "@/lib/returnPath"

/**
 * Onboarding kapısı (DOG-50, spec §3). Karar burada, saf ve testli;
 * `/onboarding` sayfası ve `(app)` layout'u yalnızca uyguluyor.
 */

export function needsOnboarding(user: { isAnonymous: boolean; onboardedAt: Date | null } | null): boolean {
  return !!user && !user.isAnonymous && user.onboardedAt === null
}

/** Onboarding'e geri dönmek döngü yaratır; dış adres açık yönlendirme. */
function safeTarget(raw: string | undefined): string {
  const target = safeReturnPath(raw)
  return target === "/onboarding" || target.startsWith("/onboarding?") ? DEFAULT_RETURN_PATH : target
}

export function onboardingPath(returnTo: string): string {
  return `/onboarding?donus=${encodeURIComponent(safeTarget(returnTo))}`
}

export type GateDecision =
  | { kind: "login"; to: string }
  | { kind: "skip"; to: string }
  | { kind: "show"; returnTo: string }

export function onboardingGate(input: {
  session: { isAnonymous: boolean } | null
  onboardedAt: Date | null
  donus: string | undefined
}): GateDecision {
  const target = safeTarget(input.donus)
  // Hedefin kendisi: giriş formu callbackURL'i zaten onboardingPath ile sarıyor.
  // İç içe sarılırsa ikinci sarmada /onboarding hedefi reddediliyor ve asıl
  // hedef kayboluyordu.
  if (!input.session) return { kind: "login", to: loginPath(target) }
  if (!needsOnboarding({ isAnonymous: input.session.isAnonymous, onboardedAt: input.onboardedAt })) {
    return { kind: "skip", to: target }
  }
  return { kind: "show", returnTo: target }
}

/**
 * Onboarding kaydı düşünce "Şimdilik geç" bu oturum çerezini bırakıyor.
 * Yoksa layout kullanıcıyı hemen geri yollar ve API düzelene kadar içeri
 * giremez; spec §6 "bir sonraki açılışta yeniden çıkar" diyor. Süresiz
 * çerez tarayıcı kapanınca siliniyor.
 */
export const ONBOARDING_DEFERRED_COOKIE = "onboarding_deferred"

/** `(app)` layout'unun kararı: gerekiyorsa ve bu oturumda ertelenmediyse. */
export function shouldRedirectToOnboarding(
  user: { isAnonymous: boolean; onboardedAt: Date | null } | null,
  deferred: boolean,
): boolean {
  return !deferred && needsOnboarding(user)
}
