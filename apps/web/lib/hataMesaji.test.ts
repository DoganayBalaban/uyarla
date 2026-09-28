import { describe, expect, it } from "vitest"
import { GECICI_HATA_MESAJI, analizHataMesaji } from "./hataMesaji"

describe("analizHataMesaji", () => {
  it("tek denemede düşen kalıcı hatanın kendi mesajını gösterir", () => {
    const mesaj = "Bu PDF taranmış bir görüntü, içinde seçilebilir metin yok."
    expect(analizHataMesaji({ failedReason: mesaj, attemptsMade: 1, opts: { attempts: 3 } })).toBe(mesaj)
  })

  it("denemeleri tüketen geçici hatanın teknik metnini gizler", () => {
    expect(
      analizHataMesaji({
        failedReason: "LLM çağrısı başarısız: Connection error.",
        attemptsMade: 3,
        opts: { attempts: 3 },
      }),
    ).toBe(GECICI_HATA_MESAJI)
  })

  it("gerekçe yoksa genel mesaja düşer", () => {
    expect(analizHataMesaji({ failedReason: null, attemptsMade: 1, opts: { attempts: 3 } })).toBe(
      GECICI_HATA_MESAJI,
    )
  })
})
