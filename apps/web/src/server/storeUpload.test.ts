import { describe, expect, it, vi } from "vitest"
import { storeUploadedResume } from "@/server/storeUpload"

function fakeStore() {
  return {
    save: vi.fn(async () => "resumes/abc.pdf"),
    delete: vi.fn(async () => true),
  }
}

describe("storeUploadedResume", () => {
  it("returns the created record and keeps the file", async () => {
    const store = fakeStore()
    const result = await storeUploadedResume(store, Buffer.from("pdf"), "cv.pdf", async (path) => ({ id: "r1", path }))

    expect(result).toEqual({ id: "r1", path: "resumes/abc.pdf" })
    expect(store.delete).not.toHaveBeenCalled()
  })

  it("deletes the saved file when the database record fails, and rethrows", async () => {
    // DOG-65: dosya depoya yazılıp kayıt düşerse sahipsiz kalıyordu.
    const store = fakeStore()
    const failure = new Error("veritabanı yok")

    await expect(
      storeUploadedResume(store, Buffer.from("pdf"), "cv.pdf", async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(store.delete).toHaveBeenCalledWith("resumes/abc.pdf")
  })

  it("still rethrows the original error if the cleanup also fails", async () => {
    const store = fakeStore()
    store.delete.mockRejectedValueOnce(new Error("R2 yok"))
    const failure = new Error("veritabanı yok")

    await expect(
      storeUploadedResume(store, Buffer.from("pdf"), "cv.pdf", async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
  })
})
