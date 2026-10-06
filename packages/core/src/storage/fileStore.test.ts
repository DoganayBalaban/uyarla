import { describe, it, expect, afterEach } from "vitest"
import { rmSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { LocalFileStore, S3FileStore, fileStoreFromEnv, isInsideStorage, type S3Like } from "./fileStore.js"

const BASE = "./.tmp-test-storage"

afterEach(() => {
  if (existsSync(BASE)) rmSync(BASE, { recursive: true, force: true })
})

describe("LocalFileStore", () => {
  it("saves and reads back the same content", async () => {
    const store = new LocalFileStore(BASE)
    const path = await store.save(Buffer.from("merhaba dünya"), "cv.pdf")
    const back = await store.read(path)
    expect(back.toString()).toBe("merhaba dünya")
  })

  it("does not overwrite two files with the same name", async () => {
    const store = new LocalFileStore(BASE)
    const a = await store.save(Buffer.from("bir"), "cv.pdf")
    const b = await store.save(Buffer.from("iki"), "cv.pdf")
    expect(a).not.toBe(b)
    expect((await store.read(a)).toString()).toBe("bir")
    expect((await store.read(b)).toString()).toBe("iki")
  })

  it("returns an absolute path", async () => {
    // Dosyayı yazan süreç (web) ile okuyan süreç (worker) farklı çalışma
    // dizinlerinde; göreli yol kaydedilirse worker dosyayı bulamaz.
    const store = new LocalFileStore(BASE)
    expect(await store.save(Buffer.from("x"), "cv.pdf")).toMatch(/^\//)
  })

  it("keeps the file extension", async () => {
    const store = new LocalFileStore(BASE)
    expect(await store.save(Buffer.from("x"), "cv.docx")).toMatch(/\.docx$/)
  })

  it("does not put the user-supplied name in the path", async () => {
    // Yol geçişi ve kişisel veri sızıntısı riski: dosya adı "elif-yilmaz-cv.pdf"
    // olabilir ve diskte kişi adı tutmak istemeyiz.
    const store = new LocalFileStore(BASE)
    const path = await store.save(Buffer.from("x"), "../../elif-yilmaz-cv.pdf")
    expect(path).not.toContain("elif")
    expect(path).not.toContain("..")
  })
})

describe("LocalFileStore.delete", () => {
  it("deletes a file it saved", async () => {
    const store = new LocalFileStore(BASE)
    const path = await store.save(Buffer.from("x"), "cv.pdf")
    expect(await store.delete(path)).toBe(true)
    expect(existsSync(path)).toBe(false)
  })

  it("treats an already missing file as deleted", async () => {
    // Hesap silme, dosya elle silinmiş diye başarısız olmamalı.
    const store = new LocalFileStore(BASE)
    expect(await store.delete(resolve(BASE, "yok.pdf"))).toBe(true)
  })

  it("refuses a path outside its directory", async () => {
    // `Resume.filePath` veritabanından geliyor; bozuk bir satır rastgele bir
    // dosyayı sildirmesin.
    const store = new LocalFileStore(BASE)
    expect(await store.delete("/etc/hosts")).toBe(false)
    expect(existsSync("/etc/hosts")).toBe(true)
  })
})

describe("isInsideStorage", () => {
  it("accepts a path under the storage directory", () => {
    expect(isInsideStorage("/veri/storage/abc.pdf", "/veri/storage")).toBe(true)
    expect(isInsideStorage("/veri/storage/alt/abc.pdf", "/veri/storage")).toBe(true)
  })

  it("rejects a path outside storage", () => {
    expect(isInsideStorage("/etc/passwd", "/veri/storage")).toBe(false)
    expect(isInsideStorage("/veri/storage/../gizli.pdf", "/veri/storage")).toBe(false)
  })

  it("does not mistake a prefix match for a directory boundary", () => {
    // "/veri/storage-yedek" dizesi "/veri/storage" ile başlıyor ama onun
    // altında değil; düz `startsWith` bu tuzağa düşer.
    expect(isInsideStorage("/veri/storage-yedek/abc.pdf", "/veri/storage")).toBe(false)
  })

  it("resolves a relative storage directory to an absolute path", () => {
    const absolute = `${process.cwd()}/storage/abc.pdf`
    expect(isInsideStorage(absolute, "./storage")).toBe(true)
  })

  it("does not treat the storage directory itself as a file", () => {
    expect(isInsideStorage("/veri/storage", "/veri/storage")).toBe(false)
  })
})

/** Bellekte çalışan sahte S3: yalnızca kullandığımız üç komut. */
function fakeS3() {
  const objects = new Map<string, Buffer>()
  const sent: string[] = []
  const client: S3Like = {
    async send(command: unknown) {
      const input = (command as { input: { Bucket: string; Key: string; Body?: Buffer } }).input
      const key = `${input.Bucket}/${input.Key}`
      if (command instanceof PutObjectCommand) {
        sent.push(`put ${key}`)
        objects.set(key, input.Body as Buffer)
        return {}
      }
      if (command instanceof GetObjectCommand) {
        sent.push(`get ${key}`)
        const body = objects.get(key)
        if (!body) throw Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey" })
        return { Body: { transformToByteArray: async () => new Uint8Array(body) } }
      }
      if (command instanceof DeleteObjectCommand) {
        sent.push(`delete ${key}`)
        objects.delete(key)
        return {}
      }
      throw new Error("beklenmeyen komut")
    },
  }
  return { client, objects, sent }
}

describe("S3FileStore", () => {
  it("saves under the resumes prefix and reads back the same content", async () => {
    const { client, objects } = fakeS3()
    const store = new S3FileStore(client, "uyarla-bucket")
    const ref = await store.save(Buffer.from("merhaba"), "cv.pdf")
    expect(ref).toMatch(/^s3:\/\/uyarla-bucket\/resumes\/[0-9a-f-]{36}\.pdf$/)
    expect(objects.size).toBe(1)
    expect((await store.read(ref)).toString()).toBe("merhaba")
  })

  it("does not put the user-supplied name in the key", async () => {
    const { client } = fakeS3()
    const ref = await new S3FileStore(client, "b").save(Buffer.from("x"), "../../elif-yilmaz-cv.docx")
    expect(ref).not.toContain("elif")
    expect(ref).not.toContain("..")
    expect(ref).toMatch(/\.docx$/)
  })

  it("deletes an object it saved", async () => {
    const { client, objects } = fakeS3()
    const store = new S3FileStore(client, "b")
    const ref = await store.save(Buffer.from("x"), "cv.pdf")
    expect(await store.delete(ref)).toBe(true)
    expect(objects.size).toBe(0)
  })

  it("refuses references it does not own", async () => {
    // Başka bucket, yerel yol ya da önek dışı anahtar: hiçbir istek gitmemeli.
    const { client, sent } = fakeS3()
    const store = new S3FileStore(client, "b")
    expect(await store.delete("s3://baska/resumes/x.pdf")).toBe(false)
    expect(await store.delete("/veri/storage/x.pdf")).toBe(false)
    expect(await store.delete("s3://b/gizli/x.pdf")).toBe(false)
    expect(await store.delete("s3://b/resumes/../x.pdf")).toBe(false)
    expect(sent).toEqual([])
  })

  it("refuses to read a reference it does not own", async () => {
    const { client } = fakeS3()
    await expect(new S3FileStore(client, "b").read("/etc/passwd")).rejects.toThrow()
  })
})

describe("fileStoreFromEnv", () => {
  it("uses S3 when a bucket is configured", () => {
    const store = fileStoreFromEnv({
      S3_BUCKET: "b",
      S3_ENDPOINT: "https://hesap.r2.cloudflarestorage.com",
      S3_ACCESS_KEY_ID: "id",
      S3_SECRET_ACCESS_KEY: "gizli",
    })
    expect(store).toBeInstanceOf(S3FileStore)
  })

  it("falls back to the local disk otherwise", () => {
    expect(fileStoreFromEnv({})).toBeInstanceOf(LocalFileStore)
  })

  it("rejects a partial S3 configuration", () => {
    // Bucket var ama anahtar yok: sessizce yerel diske düşmek üretimde
    // dosyaları kaybettirir (web ve worker ayrı makinelerde).
    expect(() => fileStoreFromEnv({ S3_BUCKET: "b" })).toThrow(/S3_ACCESS_KEY_ID/)
  })
})
