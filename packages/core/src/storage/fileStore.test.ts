import { describe, it, expect, afterEach } from "vitest"
import { rmSync, existsSync } from "node:fs"
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

  it("mutlak yol döndürür", async () => {
    // Dosyayı yazan süreç (web) ile okuyan süreç (worker) farklı çalışma
    // dizinlerinde; göreli yol kaydedilirse worker dosyayı bulamaz.
    const store = new LocalFileStore(BASE)
    expect(await store.save(Buffer.from("x"), "cv.pdf")).toMatch(/^\//)
  })

  it("dosya uzantısını korur", async () => {
    const store = new LocalFileStore(BASE)
    expect(await store.save(Buffer.from("x"), "cv.docx")).toMatch(/\.docx$/)
  })

  it("kullanıcının verdiği adı yola koymaz", async () => {
    // Yol geçişi ve kişisel veri sızıntısı riski: dosya adı "elif-yilmaz-cv.pdf"
    // olabilir ve diskte kişi adı tutmak istemeyiz.
    const store = new LocalFileStore(BASE)
    const path = await store.save(Buffer.from("x"), "../../elif-yilmaz-cv.pdf")
    expect(path).not.toContain("elif")
    expect(path).not.toContain("..")
  })
})
