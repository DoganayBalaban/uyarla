import { describe, it, expect } from "vitest"
import { TEMIZLIK_GUN, eskiAnonimKosulu, kesimTarihi } from "./temizlik"

const SIMDI = new Date("2026-09-27T12:00:00.000Z")

describe("kesimTarihi", () => {
  it("varsayılan 30 gün geriye gidiyor", () => {
    expect(TEMIZLIK_GUN).toBe(30)
    expect(kesimTarihi(SIMDI).toISOString()).toBe("2026-08-28T12:00:00.000Z")
  })

  it("gün sayısı verilebiliyor", () => {
    expect(kesimTarihi(SIMDI, 1).toISOString()).toBe("2026-09-26T12:00:00.000Z")
  })

  it("sıfır ya da negatif günü reddediyor", () => {
    // 0 gün "az önce gelen ziyaretçiyi de sil" demek: elini tam o anda
    // CV'sinin üzerinde olan kullanıcının verisini siler.
    expect(() => kesimTarihi(SIMDI, 0)).toThrow(/gün/i)
    expect(() => kesimTarihi(SIMDI, -5)).toThrow(/gün/i)
  })
})

describe("eskiAnonimKosulu", () => {
  it("yalnızca anonim ve kesimden eski kullanıcıları tutuyor", () => {
    // Bu dosyanın en kritik iddiası: iki koşuldan biri düşerse kayıtlı
    // kullanıcıların ya da dünkü ziyaretçilerin verisi silinir.
    expect(eskiAnonimKosulu(SIMDI)).toEqual({
      isAnonymous: true,
      createdAt: { lt: new Date("2026-08-28T12:00:00.000Z") },
    })
  })

  it("isAnonymous koşulu tam `true`, doğruluk değeri değil", () => {
    // Alan şemada nullable (`Boolean?`, K-34). `not: false` yazılsaydı NULL
    // taşıyan kayıtlı kullanıcılar da eşleşirdi.
    const kosul = eskiAnonimKosulu(SIMDI)
    expect(kosul.isAnonymous).toBe(true)
  })

  it("kesim `lt`, `lte` değil", () => {
    // Sınırda duran kaydı bırakıyoruz: geri alınamaz bir işlemde eşitlik
    // hâlinde silmemek doğru taraf.
    expect(eskiAnonimKosulu(SIMDI, 30).createdAt).toEqual({
      lt: new Date("2026-08-28T12:00:00.000Z"),
    })
  })
})
