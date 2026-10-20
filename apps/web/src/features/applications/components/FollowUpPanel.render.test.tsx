import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import { OutreachPanel } from "@/features/applications/components/FollowUpPanel"
import type { BoardCard } from "@/features/applications/board"

const card = (stage: BoardCard["stage"]): BoardCard => ({
  analysisId: "a1",
  position: "Frontend",
  company: null,
  score: 30,
  stage,
  stageChangedAt: null,
  noteText: null,
  interviewAt: null,
  deadline: null,
  followUps: [],
  createdAt: "",
  adaptation: null,
  readiness: null,
})
const render = (stage: BoardCard["stage"]) =>
  renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <OutreachPanel card={card(stage)} />
    </QueryClientProvider>,
  )

describe("OutreachPanel (DOG-99)", () => {
  it("is offered before and after applying, not later", () => {
    expect(render("saved")).toContain("Ağ kurma mesajı")
    expect(render("applied")).toContain("Ağ kurma mesajı")
    expect(render("interview")).toBe("")
  })
})
