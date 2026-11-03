import { describe, expect, it } from "vitest"
import type { SimulationRecord } from "@uyarla/core/interview/simulationRecord"
import { addAnswer, endSimulation, retrySimulation, simulationsLeft, startSimulation } from "./simulations"

const NOW = new Date("2026-11-03T12:00:00Z")
const sim = (patch: Partial<SimulationRecord>): SimulationRecord => ({ id: "s1", phase: "candidate", messages: [], createdAt: NOW.toISOString(), ...patch })
const done = (id: string) => sim({ id, phase: "done" })

describe("startSimulation (DOG-172)", () => {
  it("opens a new interview waiting for the interviewer", () => {
    const out = startSimulation([], "n1", NOW)
    expect(out).toMatchObject({ simulation: { id: "n1", phase: "interviewer", messages: [] } })
  })

  it("allows one interview at a time and three per application", () => {
    expect(startSimulation([sim({})], "n1", NOW)).toEqual({ error: "active_exists" })
    expect(startSimulation([done("a"), done("b"), done("c")], "n1", NOW)).toEqual({ error: "too_many" })
  })

  it("does not count an opening that failed, and replaces it", () => {
    const failed = sim({ id: "f", phase: "interviewer", failed: true })
    expect(simulationsLeft([done("a"), done("b"), failed])).toBe(1)
    const out = startSimulation([done("a"), failed], "n1", NOW)
    expect("list" in out && out.list.map((s) => s.id)).toEqual(["a", "n1"])
  })
})

describe("addAnswer", () => {
  it("appends the answer and passes the turn to the interviewer", () => {
    const out = addAnswer([sim({})], "s1", "Merhaba.", NOW)
    expect(out).toMatchObject({ simulation: { phase: "interviewer", messages: [{ role: "candidate", text: "Merhaba." }] } })
  })

  it("refuses while the interviewer is writing and after the end", () => {
    expect(addAnswer([sim({ phase: "interviewer" })], "s1", "x", NOW)).toEqual({ error: "not_your_turn" })
    expect(addAnswer([sim({ phase: "report" })], "s1", "x", NOW)).toEqual({ error: "finished" })
    expect(addAnswer([], "s1", "x", NOW)).toEqual({ error: "not_found" })
  })
})

describe("endSimulation and retrySimulation", () => {
  it("ends at any point before the report and clears a failure", () => {
    expect(endSimulation([sim({ phase: "interviewer", failed: true })], "s1")).toMatchObject({ simulation: { phase: "report" } })
    expect(endSimulation([sim({ phase: "interviewer", failed: true })], "s1")).not.toHaveProperty("simulation.failed")
    expect(endSimulation([done("s1")], "s1")).toEqual({ error: "finished" })
  })

  it("retries only a failed step, keeping its phase", () => {
    expect(retrySimulation([sim({ phase: "report", failed: true })], "s1")).toEqual({
      list: [sim({ phase: "report" })],
      simulation: sim({ phase: "report" }),
    })
    expect(retrySimulation([sim({})], "s1")).toEqual({ error: "not_failed" })
  })
})
