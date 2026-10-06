import { afterEach, describe, expect, it } from "vitest"
import { prisma } from "@uyarla/db"
import { deletionOperations } from "@/server/deleteAccount"
import { getProfile, updateProfile } from "@/server/profile"

const toClean: string[] = []
afterEach(async () => {
  await prisma.$transaction(deletionOperations(prisma, toClean))
  toClean.length = 0
})

async function makeUser() {
  const u = await prisma.user.create({ data: { name: "", email: `p-${Date.now()}-${Math.random()}@test.local` } })
  toClean.push(u.id)
  return u
}

describe("profile", () => {
  it("updates only the fields sent", async () => {
    const u = await makeUser()
    await updateProfile(prisma, u.id, { name: "Doğanay", goal: "first_job" })
    await updateProfile(prisma, u.id, { targetRole: "Frontend geliştirici" })
    expect(await getProfile(prisma, u.id)).toMatchObject({
      name: "Doğanay",
      goal: "first_job",
      targetRole: "Frontend geliştirici",
      onboardedAt: null,
    })
  })

  it("keeps the first onboarding date when completed twice", async () => {
    const u = await makeUser()
    const first = await updateProfile(prisma, u.id, { completeOnboarding: true })
    const second = await updateProfile(prisma, u.id, { completeOnboarding: true })
    expect(first.onboardedAt).not.toBeNull()
    expect(second.onboardedAt?.getTime()).toBe(first.onboardedAt?.getTime())
  })

  it("returns null for an unknown user", async () => {
    expect(await getProfile(prisma, "yok")).toBeNull()
  })
})
