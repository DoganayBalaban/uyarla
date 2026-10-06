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
  if (!input.session) return { kind: "login", to: loginPath(onboardingPath(target)) }
  if (!needsOnboarding({ isAnonymous: input.session.isAnonymous, onboardedAt: input.onboardedAt })) {
    return { kind: "skip", to: target }
  }
  return { kind: "show", returnTo: target }
}
