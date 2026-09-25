import { describe, it, expect, afterEach } from "vitest"
import { rmSync, existsSync } from "node:fs"
import { isAbsolute } from "node:path"
import { LocalFileStore } from "./fileStore.js"

const BASE = "./.tmp-test-storage"

afterEach(() => {
  if (existsSync(BASE)) rmSync(BASE, { recursive: true, force: true })
})

describe("LocalFileStore", () => {
  it("kaydedip aynı içeriği geri okur", async () => {
    const store = new LocalFileStore(BASE)
    const path = await store.save(Buffer.from("merhaba dünya"), "cv.pdf")
    const back = await store.read(path)
    expect(back.toString()).toBe("merhaba dünya")
  })

  it("aynı ada sahip iki dosyayı birbirine yazmaz", async () => {
    const store = new LocalFileStore(BASE)
    const a = await store.save(Buffer.from("bir"), "cv.pdf")
    const b = await store.save(Buffer.from("iki"), "cv.pdf")
    expect(a).not.toBe(b)
    expect((await store.read(a)).toString()).toBe("bir")
    expect((await store.read(b)).toString()).toBe("iki")
  })

  it("göreli taban dizinde bile mutlak yol döndürür", async () => {
    const store = new LocalFileStore(BASE)
    const path = await store.save(Buffer.from("x"), "cv.docx")
    expect(isAbsolute(path)).toBe(true)
    expect(path.endsWith(".docx")).toBe(true)
  })
})
