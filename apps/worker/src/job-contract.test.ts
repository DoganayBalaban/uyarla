import { describe, expect, expectTypeOf, it } from "vitest"
import { ADAPT_QUEUE, type AdaptJobData, COVER_LETTER_JOB } from "./adapt-queue"
import { ANALYZE_QUEUE, type AnalyzeJobData } from "./queue"

/**
 * Web kuyruğa bu adlarla ve bu alanlarla iş koyuyor. Biri değişirse,
 * güncellenmemiş bir web sürecinin koyduğu iş worker'da düşer; bu test o
 * değişikliği görünür kılıyor.
 */
describe("job contract", () => {
  it("keeps queue and job names", () => {
    expect(ANALYZE_QUEUE).toBe("analyze")
    expect(ADAPT_QUEUE).toBe("adapt")
    expect(COVER_LETTER_JOB).toBe("cover-letter")
  })

  it("keeps job data keys", () => {
    expectTypeOf<keyof AnalyzeJobData>().toEqualTypeOf<"resumeId" | "jobPostingId" | "userId">()
    expectTypeOf<keyof AdaptJobData>().toEqualTypeOf<"adaptationId">()
  })
})
