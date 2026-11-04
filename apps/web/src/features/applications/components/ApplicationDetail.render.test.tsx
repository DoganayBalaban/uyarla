import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { ApplicationView } from "@/features/applications/components/ApplicationDetail"
import type { BoardCard } from "@/features/applications/board"

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }))
// Başlık kırıntısı kabuğun bağlamını istiyor; burada önemli değil.
vi.mock("@/components/layout/app-shell/PageActions", () => ({ PageCrumb: () => null }))

const card = (over: Partial<BoardCard> = {}): BoardCard => ({
  analysisId: "a1",
  position: "Senior NLP Data Scientist",
  company: "ING Hubs Türkiye",
  score: 39,
  scoringRevision: 3,
  stage: "saved",
  stageChangedAt: "2026-10-26T10:00:00.000Z",
  noteText: null,
  interviewAt: null,
  deadline: null,
  followUps: [],
  createdAt: "2026-10-26T10:00:00.000Z",
  adaptation: null,
  readiness: { ready: false, missingMust: 3, titleMissing: true },
  ...over,
})

const render = (c: BoardCard) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <ApplicationView card={c} onUpdate={() => {}} onDeleted={() => {}} />
    </QueryClientProvider>,
  )

describe("ApplicationView (DOG-176)", () => {
  it("shows every section on one screen, without tabs", () => {
    const html = render(card())
    expect(html).not.toContain('role="tablist"')
    for (const title of ["CV ve skor", "Mesajlar", "Mülakat", "Tarihler", "Not"]) expect(html).toContain(title)
    expect(html).toContain("3 zorunlu gereksinim CV&#x27;nde görünmüyor; ilandaki unvan CV&#x27;nde geçmiyor.")
    expect(html).toContain("CV&#x27;ni bu ilana uyarla")
    expect(html).toContain("İlanda yazmıyor")
  })

  it("marks the current stage on the track and completed ones before it", () => {
    const html = render(card({ stage: "interview" }))
    expect(html).toMatch(/aria-current="step"[^>]*>.*?Mülakat/)
    expect(html.match(/lucide-check/g)?.length).toBe(2)
    expect(html).toContain("Mülakat hazırlığı")
  })

  it("replaces the track with a single line when it did not work out", () => {
    const html = render(card({ stage: "rejected" }))
    expect(html).not.toContain('aria-label="Başvuru aşaması"')
    expect(html).toContain("Olmadı")
    expect(html).toContain("Bu aşamada önerilen bir mesaj yok.")
  })

  it("links to the adapted CV when there is one", () => {
    const html = render(card({ adaptation: { id: "ad1", status: "ready" }, scoreBefore: 32 }))
    expect(html).toContain('href="/adapt/ad1"')
    expect(html).toContain("uyarlamadan önce 32")
  })
})
