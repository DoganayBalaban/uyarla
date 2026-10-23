import { describe, expect, it, vi } from "vitest"
import { AuditBusyError, createAudit } from "@/server/linkedinAudit"

function fakeDb(existing: Array<{ id: string; status: string; createdAt: Date }>) {
  const created: unknown[] = []
  const deleted: unknown[] = []
  const db = {
    linkedInAudit: {
      // Gerçek sorgu gibi: yalnızca son 10 dakikadaki "running".
      findFirst: vi.fn(async ({ where }: { where: { createdAt: { gt: Date } } }) => existing.find((a) => a.status === "running" && a.createdAt > where.createdAt.gt) ?? null),
      findMany: vi.fn(async () => existing.map((a) => ({ id: a.id }))),
      create: vi.fn(async ({ data }: { data: unknown }) => {
        created.push(data)
        return { id: "yeni" }
      }),
      deleteMany: vi.fn(async (args: unknown) => {
        deleted.push(args)
        return { count: 0 }
      }),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  }
  return { db, created, deleted }
}

const input = { source: "pdf" as const, resumeId: "r1", profile: null, targetRole: null, analysisIds: [] }
const now = new Date("2026-10-22T12:00:00Z")

describe("createAudit", () => {
  it("refuses a second audit while one is running (double click, two tabs)", async () => {
    const { db } = fakeDb([{ id: "suren", status: "running", createdAt: new Date("2026-10-22T11:58:00Z") }])
    await expect(createAudit(db as never, "u1", input, now)).rejects.toBeInstanceOf(AuditBusyError)
  })

  it("lets a new audit start when the running one is stuck", async () => {
    const { db, created } = fakeDb([{ id: "takili", status: "running", createdAt: new Date("2026-10-22T11:30:00Z") }])
    await expect(createAudit(db as never, "u1", input, now)).resolves.toEqual({ id: "yeni" })
    expect(created).toHaveLength(1)
  })

  it("keeps only the newest five audits", async () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, status: "done", createdAt: new Date(2026, 9, 1 + i) }))
    const { db, deleted } = fakeDb(existing)
    await createAudit(db as never, "u1", input, now)
    expect(db.linkedInAudit.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5 }))
    expect(deleted).toHaveLength(1)
  })
})
