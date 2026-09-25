import { describe, it, expect } from "vitest"
import type { AdaptationDraft } from "@uyarla/core"
import { applyDecision, nextStatus } from "./adaptation"

const taslak: AdaptationDraft = {
  summary: {
    original: "eski",
    rewritten: "yeni",
    verification: { status: "ok", issues: [] },
    decision: "accepted",
  },
  bullets: [
    {
      id: "0-0",
      experienceIndex: 0,
      original: "a",
      sourceRef: "a",
      rewritten: "A",
      verification: { status: "ok", issues: [] },
      decision: "accepted",
    },
    {
      id: "0-1",
      experienceIndex: 0,
      original: "b",
      sourceRef: "b",
      rewritten: "B",
      verification: {
        status: "flagged",
        issues: [{ kind: "number_mismatch", detail: "…" }],
      },
      decision: "pending",
    },
  ],
  skillOrder: ["React"],
}

describe("applyDecision", () => {
  it("maddenin kararını değiştirir", () => {
    expect(applyDecision(taslak, "0-1", "accepted").bullets[1]!.decision).toBe("accepted")
  })

  it("diğer maddelere dokunmaz", () => {
    expect(applyDecision(taslak, "0-1", "rejected").bullets[0]!.decision).toBe("accepted")
  })

  it("summary kimliğiyle özetin kararını değiştirir", () => {
    expect(applyDecision(taslak, "summary", "rejected").summary.decision).toBe("rejected")
  })

  it("bilinmeyen kimlikte hata fırlatır", () => {
    // Sessizce yok saymak, kullanıcının tıkladığı kararın kaybolması demek.
    expect(() => applyDecision(taslak, "yok", "accepted")).toThrow(/bulunamadı/i)
  })

  it("girdi taslağını değiştirmez", () => {
    applyDecision(taslak, "0-1", "accepted")
    expect(taslak.bullets[1]!.decision).toBe("pending")
  })
})

describe("nextStatus", () => {
  it("bekleyen karar varsa draft", () => {
    expect(nextStatus(taslak)).toBe("draft")
  })

  it("bekleyen karar yoksa ready", () => {
    expect(nextStatus(applyDecision(taslak, "0-1", "rejected"))).toBe("ready")
  })
})
