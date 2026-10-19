import { describe, expect, it } from "vitest"
import { withoutNegatedClauses } from "./negation.js"

describe("withoutNegatedClauses", () => {
  it("drops a Turkish negated list but keeps the claim after the connector", () => {
    const out = withoutNegatedClauses("REST API, SQL ve Docker ile doğrudan çalışmadım; ancak Python ve Git kullandım.")
    expect(out).not.toMatch(/Docker|SQL|REST/)
    expect(out).toContain("Python ve Git kullandım")
  })

  it("keeps a claim joined to a denial by a connector", () => {
    const out = withoutNegatedClauses("Docker'ı kullanmadım ama Kubernetes ile çalıştım.")
    expect(out).toContain("Kubernetes")
    expect(out).not.toContain("Docker")
  })

  it("keeps a claim after a finite verb and comma", () => {
    const out = withoutNegatedClauses("Docker ile 3 servis kurdum, Kubernetes deneyimim yok.")
    expect(out).toContain("Docker")
    expect(out).not.toContain("Kubernetes")
  })

  it("handles English denial first, then claim after the comma", () => {
    const out = withoutNegatedClauses("While I have not worked on GCP or Vertex AI, my experience with Docker helps.")
    expect(out).not.toMatch(/GCP|Vertex/)
    expect(out).toContain("Docker")
  })

  it("handles the Turkish 'olmamakla birlikte' bridge", () => {
    const out = withoutNegatedClauses("Kubernetes ile doğrudan deneyimim olmamakla birlikte, Docker üzerinde çalıştım.")
    expect(out).not.toContain("Kubernetes")
    expect(out).toContain("Docker üzerinde çalıştım")
  })

  it("does not take 'doğrudan' for a negation", () => {
    expect(withoutNegatedClauses("Kubernetes kümesini doğrudan yönettim.")).toContain("Kubernetes")
  })
})
