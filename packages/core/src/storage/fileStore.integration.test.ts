import { describe, expect, it } from "vitest"
import { S3FileStore, fileStoreFromEnv } from "./fileStore.js"

/**
 * Gerçek bucket'a karşı (üretimde Cloudflare R2). Ayar yoksa atlanıyor.
 * Çalıştırma: pnpm --filter @uyarla/core test:integration fileStore
 */
describe.skipIf(!process.env.S3_BUCKET)("S3FileStore (gerçek bucket)", () => {
  it("saves, reads back and deletes a file", async () => {
    const store = fileStoreFromEnv()
    expect(store).toBeInstanceOf(S3FileStore)

    const content = Buffer.from(`uyarla tümleşik testi ${new Date().toISOString()}`)
    const ref = await store.save(content, "test.txt")
    try {
      expect((await store.read(ref)).equals(content)).toBe(true)
    } finally {
      expect(await store.delete(ref)).toBe(true)
    }
    await expect(store.read(ref)).rejects.toThrow()
  })
})
