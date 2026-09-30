import { describe, it, expect } from "vitest"
import { AuthError, ensureOwner, ensureRegistered, ensureSession } from "./authz"

const registered = { user: { id: "u1", isAnonymous: false } }
const anonUser = { user: { id: "a1", isAnonymous: true } }

describe("ensureSession", () => {
  it("returns the session when present", () => {
    expect(ensureSession(registered)).toBe(registered)
  })

  it("also accepts an anonymous session", () => {
    // Skor almak için kayıt gerekmiyor (spec §7).
    expect(ensureSession(anonUser)).toBe(anonUser)
  })

  it("throws 401 without a session", () => {
    expect(() => ensureSession(null)).toThrow(AuthError)
    try {
      ensureSession(null)
    } catch (e) {
      expect((e as AuthError).status).toBe(401)
      expect((e as AuthError).message).toMatch(/giriş/i)
    }
  })
})

describe("ensureRegistered", () => {
  it("passes a registered session", () => {
    expect(ensureRegistered(registered)).toBe(registered)
  })

  it("returns 401 and a sign-up prompt for an anonymous session", () => {
    // Uyarlama kayıt gerektiriyor (spec §8).
    try {
      ensureRegistered(anonUser)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect((e as AuthError).status).toBe(401)
      expect((e as AuthError).code).toBe("kayit_gerekli")
      expect((e as AuthError).message).toMatch(/e-posta/i)
    }
  })

  it("throws 401 without a session", () => {
    expect(() => ensureRegistered(null)).toThrow(AuthError)
  })
})

describe("ensureOwner", () => {
  it("passes the owner session", () => {
    expect(ensureOwner("u1", registered)).toBe(registered)
  })

  it("returns 404, not 403, for another user's resource", () => {
    // 403 kaynağın var olduğunu sızdırır (spec §8).
    try {
      ensureOwner("baskasi", registered)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect((e as AuthError).status).toBe(404)
      expect((e as AuthError).message).toBe("Bulunamadı.")
    }
  })

  it("returns 404 for an ownerless resource", () => {
    // Sahipsiz satır bir hata durumu; kimseye açılmamalı.
    expect(() => ensureOwner(null, registered)).toThrow(AuthError)
  })

  it("throws 401 without a session", () => {
    // Sahiplik karşılaştırmasından önce oturum gerekiyor; aksi hâlde
    // null === null gibi bir kaza sahipsiz kaynağı herkese açardı.
    try {
      ensureOwner(null, null)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect((e as AuthError).status).toBe(401)
    }
  })

  it("an anonymous owner can access its own resource", () => {
    // Kayıtsız kullanıcı kendi skorunu görebilmeli (spec §7).
    expect(ensureOwner("a1", anonUser)).toBe(anonUser)
  })
})
