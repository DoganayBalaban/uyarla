import type { Phase } from "@/features/landing/demos/demoScript"
import { HERO_PHASES } from "@/features/landing/demos/demoScript"
import { HeroFilm } from "@/features/landing/demos/HeroDemo"

/** Vitrinde (`/ui/landing`) kare kare bakılan sahneler. */
export const SCENE_LIST: { id: string; name: string; phases: readonly Phase[]; Film: (p: { ms: number }) => React.ReactNode }[] = [
  { id: "hero", name: "Hero", phases: HERO_PHASES, Film: HeroFilm },
]
