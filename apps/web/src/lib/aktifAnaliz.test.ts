import { beforeEach, describe, expect, it } from "vitest"
import {
  aktifAnaliziBaslat,
  aktifAnaliziGuncelle,
  aktifAnaliziOku,
  aktifAnaliziTemizle,
  sonucAdresi,
  yanitiIsle,
} from "./aktifAnaliz"

/** Testler node ortamında; tarayıcının iki yüzeyi elle sağlanıyor. */
function sahteTarayici() {
  const depo = new Map<string, string>()
  const olaylar: string[] = []
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => depo.get(k) ?? null,
      setItem: (k: string, v: string) => void depo.set(k, v),
      removeItem: (k: string) => void depo.delete(k),
    },
    dispatchEvent: (e: Event) => {
      olaylar.push(e.type)
      return true
    },
  }
  return { olaylar }
}

describe("aktifAnaliz", () => {
  let olaylar: string[]
  beforeEach(() => {
    olaylar = sahteTarayici().olaylar
  })

  it("başlatılan analizi okur ve dinleyicilere haber verir", () => {
    aktifAnaliziBaslat("42")
    expect(aktifAnaliziOku()).toMatchObject({ jobId: "42", durum: "running" })
    expect(olaylar).toContain("uyarla:aktif-analiz")
  })

  it("yoklama yanıtlarını kayda işler", () => {
    aktifAnaliziBaslat("42")
    yanitiIsle("42", { status: "running", stage: "ilan_okunuyor" })
    expect(aktifAnaliziOku()!.asama).toBe("ilan_okunuyor")

    yanitiIsle("42", { status: "completed", analysisId: "an1", score: 53 })
    expect(aktifAnaliziOku()).toMatchObject({ durum: "completed", analysisId: "an1", skor: 53 })
  })

  it("başarısız analizin gerekçesini saklar", () => {
    aktifAnaliziBaslat("42")
    yanitiIsle("42", { status: "failed", error: "Bu PDF taranmış bir görüntü." })
    expect(aktifAnaliziOku()).toMatchObject({ durum: "failed", hata: "Bu PDF taranmış bir görüntü." })
  })

  it("başka bir işe ait güncellemeyi yok sayar", () => {
    // Eski sekmedeki yoklama yeni analizin kaydını bozmamalı.
    aktifAnaliziBaslat("43")
    aktifAnaliziGuncelle("42", { durum: "completed" })
    expect(aktifAnaliziOku()!.durum).toBe("running")
  })

  it("temizlenince kayıt kalmaz", () => {
    aktifAnaliziBaslat("42")
    aktifAnaliziTemizle()
    expect(aktifAnaliziOku()).toBeNull()
  })

  it("depolama erişilemezse hata fırlatmaz", () => {
    ;(globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => {
          throw new Error("engelli")
        },
        setItem: () => {
          throw new Error("engelli")
        },
        removeItem: () => {},
      },
      dispatchEvent: () => true,
    }
    expect(() => aktifAnaliziBaslat("42")).not.toThrow()
    expect(aktifAnaliziOku()).toBeNull()
  })

  it("kalıcı sonuç adresini üretir", () => {
    expect(sonucAdresi("an 1")).toBe("/analyze?analiz=an%201")
  })
})
