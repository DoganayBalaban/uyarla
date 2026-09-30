import { describe, expect, it } from "vitest"
import { upgradeCoverLetter, upgradeFormatReport } from "@/server/legacyJsonKeys"

describe("upgradeFormatReport", () => {
  it("renames legacy keys, severity values and finding codes", () => {
    const { value, changed } = upgradeFormatReport({
      gecenler: ["E-posta adresi"],
      bulgular: [{ kod: "metin_kutusu", seviye: "sorun", baslik: "Metin kutusu", aciklama: "…" }],
    })
    expect(changed).toBe(true)
    expect(value).toEqual({
      passed: ["E-posta adresi"],
      findings: [{ code: "text_box", severity: "problem", title: "Metin kutusu", description: "…" }],
    })
  })

  it("maps every legacy finding code", () => {
    const eski = [
      "cok_kisa", "cok_sutun", "cok_uzun", "eposta_ust_bilgide", "eposta_yok", "gorsel", "ikon_karakteri",
      "metin_kutusu", "sutun_belirtisi", "tablo", "tarih_yok", "telefon_yok", "ust_alt_bilgi",
    ]
    const { value } = upgradeFormatReport({
      gecenler: [],
      bulgular: eski.map((kod) => ({ kod, seviye: "uyari", baslik: "", aciklama: "" })),
    })
    const codes = (value as { findings: Array<{ code: string; severity: string }> }).findings
    expect(codes.map((f) => f.code)).toEqual([
      "too_short", "multiple_columns", "too_long", "email_in_header", "email_missing", "image", "icon_characters",
      "text_box", "column_hint", "table", "dates_missing", "phone_missing", "header_footer",
    ])
    expect(new Set(codes.map((f) => f.severity))).toEqual(new Set(["warning"]))
  })

  it("leaves an already upgraded report untouched", () => {
    const yeni = { passed: [], findings: [{ code: "text_box", severity: "warning", title: "t", description: "d" }] }
    expect(upgradeFormatReport(yeni)).toEqual({ value: yeni, changed: false })
  })

  it("ignores values that are not reports", () => {
    expect(upgradeFormatReport(null)).toEqual({ value: null, changed: false })
    expect(upgradeFormatReport("x")).toEqual({ value: "x", changed: false })
  })
})

describe("upgradeCoverLetter", () => {
  it("renames record and paragraph keys and keeps other fields", () => {
    const kontrol = { status: "ok", issues: [] }
    const { value, changed } = upgradeCoverLetter({
      durum: "done",
      tokenUsage: 1528,
      olusturulma: "2026-09-28T16:51:55.573Z",
      paragraflar: [{ metin: "Merhaba", kontrol }],
    })
    expect(changed).toBe(true)
    expect(value).toEqual({
      status: "done",
      tokenUsage: 1528,
      createdAt: "2026-09-28T16:51:55.573Z",
      paragraphs: [{ text: "Merhaba", verification: kontrol }],
    })
  })

  it("upgrades a running or failed record without paragraphs", () => {
    expect(upgradeCoverLetter({ durum: "running" })).toEqual({ value: { status: "running" }, changed: true })
  })

  it("leaves an already upgraded letter untouched", () => {
    const yeni = { status: "done", paragraphs: [{ text: "a", verification: {} }], createdAt: "x", tokenUsage: 1 }
    expect(upgradeCoverLetter(yeni)).toEqual({ value: yeni, changed: false })
  })
})
