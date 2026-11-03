import { describe, expect, it } from "vitest"
import type { SimulationRecord } from "@uyarla/core/interview/simulationRecord"
import { simulationPollDelay, withSimulation, type SimulationData } from "./simulationApi"

const sim = (patch: Partial<SimulationRecord>): SimulationRecord => ({ id: "s1", phase: "candidate", messages: [], createdAt: "2026-11-03T12:00:00Z", ...patch })
const data = (...simulations: SimulationRecord[]): SimulationData => ({ position: "X", company: null, language: "tr", ready: true, simulations, simulationsLeft: 2 })

describe("simulationPollDelay (DOG-172)", () => {
  it("polls while the interviewer or the report is being written", () => {
    expect(simulationPollDelay(data(sim({ phase: "interviewer" })))).toBe(1200)
    expect(simulationPollDelay(data(sim({ phase: "report" })))).toBe(1200)
  })

  it("stops on the candidate's turn, after the end and on a failed step", () => {
    expect(simulationPollDelay(data(sim({})))).toBe(false)
    expect(simulationPollDelay(data(sim({ phase: "done" })))).toBe(false)
    expect(simulationPollDelay(data(sim({ phase: "interviewer", failed: true })))).toBe(false)
    expect(simulationPollDelay(undefined)).toBe(false)
  })
})

describe("withSimulation", () => {
  it("replaces a known interview and appends a new one in place of a failed opening", () => {
    expect(withSimulation(data(sim({})), sim({ phase: "interviewer" })).simulations).toEqual([sim({ phase: "interviewer" })])
    const failed = sim({ id: "f", phase: "interviewer", failed: true })
    expect(withSimulation(data(sim({ id: "a", phase: "done" }), failed), sim({ id: "n" })).simulations.map((s) => s.id)).toEqual(["a", "n"])
  })
})
