import { prisma } from "@uyarla/db"
import { afterEach, describe, expect, it } from "vitest"
import { deletionOperations } from "@/server/deleteAccount"
import { AuditBusyError, createAudit } from "@/server/linkedinAudit"

const toClean: string[] = []

afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

const input = { source: "pdf" as const, resumeId: "r1", profile: null, targetRole: null, analysisIds: [] }

describe("createAudit (gerçek veritabanı)", () => {
  it("opens one audit for two truly concurrent requests (two tabs, extension and PDF at once)", async () => {
    const user = await prisma.user.create({ data: { name: "ayni-anda", email: `ayni-anda-${Date.now()}-${Math.random()}@test.local` } })
    toClean.push(user.id)
    const results = await Promise.allSettled([createAudit(prisma, user.id, input), createAudit(prisma, user.id, input), createAudit(prisma, user.id, input)])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason instanceof AuditBusyError)).toBe(true)
    expect(await prisma.linkedInAudit.count({ where: { userId: user.id } })).toBe(1)
  })
})
