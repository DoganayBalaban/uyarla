import { JOURNEY, type StepId } from "@/features/landing/journey"
import VOICE from "./voice.json"

/**
 * "uyarla nedir" tanıtım videosunun senaryosu (DOG-164): giriş, altı adım,
 * Chrome eklentisi, kapanış. Adım adları ve başlıkları tanıtım sayfasının
 * JOURNEY'sinden; sahneler aynı filmler. Seslendirme cümle başına bir
 * dosya (public/tanitim/<id>.wav); sürelerin kaynağı narration.json.
 * TTS rakamı yanlış okuduğu için sayılar yazıyla.
 */
export type Segment = {
  id: string
  kind: "intro" | "step" | "outro"
  label?: string
  title?: string
  scene?: string
  from?: string
  to?: string
}

const step = (id: StepId) => JOURNEY.find((s) => s.id === id)!
const label = (id: StepId) => `${step(id).number} · ${step(id).name}`

/** Seslendirme cümleleri: voice.json (TTS betiği de onu okuyor). */
export const voiceOf = (id: string): string => (VOICE as Record<string, string>)[id]!

export const SEGMENTS: Segment[] = [
  { id: "giris", kind: "intro" },
  { id: "bul", kind: "step", label: label("bul"), title: step("bul").title, scene: "bul", from: "query", to: "open" },
  { id: "uyarla", kind: "step", label: label("uyarla"), title: step("uyarla").title, scene: "hero", from: "score", to: "hold" },
  { id: "basvur", kind: "step", label: label("basvur"), title: step("basvur").title, scene: "basvur", from: "answer", to: "letter" },
  { id: "takip", kind: "step", label: label("takip"), title: step("takip").title, scene: "takip", from: "adapted", to: "note" },
  { id: "hazirlan", kind: "step", label: label("hazirlan"), title: step("hazirlan").title, scene: "hazirlan", from: "answer", to: "flag" },
  { id: "gorunur", kind: "step", label: label("gorunur"), title: step("gorunur").title, scene: "gorunur", from: "audit", to: "evidence" },
  { id: "eklenti", kind: "step", label: "Chrome eklentisi", title: "İlanı bulduğun yerde ölç.", scene: "eklenti", from: "point", to: "score" },
  { id: "kapanis", kind: "outro" },
]
