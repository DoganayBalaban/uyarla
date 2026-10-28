import type { Phase } from "@/features/landing/demos/demoScript"
import { HERO_PHASES } from "@/features/landing/demos/demoScript"
import { HeroFilm } from "@/features/landing/demos/HeroDemo"
import { JobSearchFilm } from "@/features/landing/demos/JobSearchDemo"
import { ApplyFilm } from "@/features/landing/demos/ApplyDemo"
import { BoardFilm } from "@/features/landing/demos/BoardDemo"
import { InterviewFilm } from "@/features/landing/demos/InterviewDemo"
import { LinkedInFilm } from "@/features/landing/demos/LinkedInDemo"
import { CheckFilm } from "@/features/landing/demos/CheckFilm"
import { APPLY_PHASES, BOARD_PHASES, CHECK_PHASES, INTERVIEW_PHASES, JOB_PHASES, LINKEDIN_PHASES } from "@/features/landing/demos/scenes"

/** Vitrinde (`/ui/landing`) kare kare bakılan sahneler. */
export const SCENE_LIST: { id: string; name: string; phases: readonly Phase[]; Film: (p: { ms: number }) => React.ReactNode }[] = [
  { id: "hero", name: "Hero", phases: HERO_PHASES, Film: HeroFilm },
  { id: "bul", name: "Bul", phases: JOB_PHASES, Film: JobSearchFilm },
  { id: "basvur", name: "Başvur", phases: APPLY_PHASES, Film: ApplyFilm },
  { id: "takip", name: "Takip et", phases: BOARD_PHASES, Film: BoardFilm },
  { id: "hazirlan", name: "Hazırlan", phases: INTERVIEW_PHASES, Film: InterviewFilm },
  { id: "gorunur", name: "Görünür ol", phases: LINKEDIN_PHASES, Film: LinkedInFilm },
  { id: "kontrol", name: "Uydurma kontrolü", phases: CHECK_PHASES, Film: CheckFilm },
]
