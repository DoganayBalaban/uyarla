import { describe, it, expect } from "vitest"
import { AuthError, ensureOwner, ensureRegistered, ensureSession } from "./authz"

const kayitli = { user: { id: "u1", isAnonymous: false } }
const anonim = { user: { id: "a1", isAnonymous: true } }

describe("ensureSession", () => {
  it("oturum varsa döndürür", () => {
    expect(ensureSession(kayitli)).toBe(kayitli)
  })

  it("anonim oturumu da kabul eder", () => {
    // Skor almak için kayıt gerekmiyor (spec §7).
    expect(ensureSession(anonim)).toBe(anonim)
  })

  it("oturum yoksa 401 fırlatır", () => {
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
  it("kayıtlı oturumu geçirir", () => {
    expect(ensureRegistered(kayitli)).toBe(kayitli)
  })

  it("anonim oturumda 401 ve kayıt çağrısı döner", () => {
    // Uyarlama kayıt gerektiriyor (spec §8).
    try {
      ensureRegistered(anonim)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect((e as AuthError).status).toBe(401)
      expect((e as AuthError).code).toBe("kayit_gerekli")
      expect((e as AuthError).message).toMatch(/e-posta/i)
    }
  })

  it("oturum yoksa 401 fırlatır", () => {
    expect(() => ensureRegistered(null)).toThrow(AuthError)
  })
})

describe("ensureOwner", () => {
  it("sahip oturumu geçirir", () => {
    expect(ensureOwner("u1", kayitli)).toBe(kayitli)
  })

  it("başkasının kaynağında 404 döner, 403 değil", () => {
    // 403 kaynağın var olduğunu sızdırır (spec §8).
    try {
      ensureOwner("baskasi", kayitli)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect((e as AuthError).status).toBe(404)
      expect((e as AuthError).message).toBe("Bulunamadı.")
    }
  })

  it("sahipsiz kaynakta 404 döner", () => {
    // Sahipsiz satır bir hata durumu; kimseye açılmamalı.
    expect(() => ensureOwner(null, kayitli)).toThrow(AuthError)
  })

  it("oturum yoksa 401 fırlatır", () => {
    // Sahiplik karşılaştırmasından önce oturum gerekiyor; aksi hâlde
    // null === null gibi bir kaza sahipsiz kaynağı herkese açardı.
    try {
      ensureOwner(null, null)
      throw new Error("fırlatmalıydı")
    } catch (e) {
      expect((e as AuthError).status).toBe(401)
    }
  })

  it("anonim sahip kendi kaynağına erişebilir", () => {
    // Kayıtsız kullanıcı kendi skorunu görebilmeli (spec §7).
    expect(ensureOwner("a1", anonim)).toBe(anonim)
  })
})
