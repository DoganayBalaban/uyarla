import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import { checkFormat } from "./check.js"

const IYI_CV = `Elif Yılmaz
Frontend Geliştirici
elif@ornek.com · +90 532 111 22 33

Özet
React ve TypeScript ile arayüz geliştiren bir geliştiriciyim.

Deneyim
Acme Yazılım — Frontend Geliştirici (03/2022 – Günümüz)
${"React ile müşteri paneli geliştirdim ve performansı iyileştirdim. ".repeat(20)}

Eğitim
İstanbul Üniversitesi, Bilgisayar Mühendisliği (2016 – 2020)

Beceriler
React, TypeScript, Jest, Git`

async function docx(govde: string, ekler: Record<string, string> = {}): Promise<Buffer> {
  const zip = new JSZip()
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document><w:body>${govde}</w:body></w:document>`,
  )
  for (const [ad, icerik] of Object.entries(ekler)) zip.file(ad, icerik)
  return zip.generateAsync({ type: "nodebuffer" })
}

const kodlar = (r: { bulgular: { kod: string }[] }) => r.bulgular.map((b) => b.kod)

describe("checkFormat · metin", () => {
  it("düzgün bir CV'de bulgu yok", async () => {
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text: IYI_CV })
    expect(r.bulgular).toEqual([])
    expect(r.gecenler).toContain("Deneyim başlığı")
  })

  it("e-posta ve telefon yoksa söylüyor", async () => {
    const text = IYI_CV.replace("elif@ornek.com · +90 532 111 22 33", "")
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(kodlar(r)).toEqual(expect.arrayContaining(["eposta_yok", "telefon_yok"]))
    // Sorunlar uyarılardan önce geliyor.
    expect(r.bulgular[0]!.seviye).toBe("sorun")
  })

  it("tire ile yazılmış yıl aralığını telefon saymıyor", async () => {
    const text = IYI_CV.replace(" · +90 532 111 22 33", "").replace("2016 – 2020", "2016 - 2020")
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(kodlar(r)).toContain("telefon_yok")
  })

  it.each(["0532 111 22 33", "+90 (532) 111-22-33", "05321112233"])("%s telefon sayılıyor", async (tel) => {
    const text = IYI_CV.replace("+90 532 111 22 33", tel)
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(kodlar(r)).not.toContain("telefon_yok")
  })

  it("standart dışı deneyim başlığını tanımıyor", async () => {
    const text = IYI_CV.replace("\nDeneyim\n", "\nYolculuğum\n")
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(kodlar(r)).toContain("baslik_yok_experience")
  })

  it("art arda gelen başlıkları sütun belirtisi sayıyor", async () => {
    const text = IYI_CV.replace("Özet\nReact ve TypeScript ile", "Özet\nDeneyim\nReact ve TypeScript ile")
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(kodlar(r)).toContain("sutun_belirtisi")
  })

  it("tarih yoksa, kısaysa ve ikon karakteri varsa uyarıyor", async () => {
    const text = "Ali\nali@ornek.com 0532 111 22 33\nDeneyim\nAcme\nEğitim\nOkul\nBeceriler\nReact"
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text: text + "   " })
    expect(kodlar(r)).toEqual(expect.arrayContaining(["tarih_yok", "cok_kisa", "ikon_karakteri"]))
  })
})

describe("checkFormat · DOCX yapısı", () => {
  it("metin kutusu, çok sütun, tablo, üst bilgi ve görseli buluyor", async () => {
    const buffer = await docx(
      `<w:tbl><w:tr/></w:tbl><w:txbxContent/><w:sectPr><w:cols w:num="2"/></w:sectPr>`,
      {
        "word/header1.xml": "<w:hdr><w:p><w:r><w:t>Elif Yılmaz</w:t></w:r></w:p></w:hdr>",
        "word/media/image1.png": "x",
      },
    )
    const r = await checkFormat({ filename: "cv.docx", buffer, text: IYI_CV })
    expect(kodlar(r)).toEqual(
      expect.arrayContaining(["metin_kutusu", "cok_sutun", "tablo", "ust_alt_bilgi", "gorsel"]),
    )
    expect(r.bulgular.find((b) => b.kod === "cok_sutun")!.baslik).toBe("2 sütunlu sayfa düzeni")
  })

  it("e-posta yalnızca üst bilgideyse bunu ayrıca söylüyor", async () => {
    const buffer = await docx("<w:p/>", {
      "word/header1.xml": "<w:hdr><w:t>elif@ornek.com</w:t></w:hdr>",
    })
    const text = IYI_CV.replace("elif@ornek.com · ", "")
    const r = await checkFormat({ filename: "cv.docx", buffer, text })
    expect(kodlar(r)).toContain("eposta_ust_bilgide")
    expect(kodlar(r)).not.toContain("eposta_yok")
    expect(kodlar(r)).not.toContain("ust_alt_bilgi")
  })

  it("temiz DOCX'te yapısal bulgu yok", async () => {
    const buffer = await docx("<w:p><w:r><w:t>metin</w:t></w:r></w:p>")
    const r = await checkFormat({ filename: "cv.docx", buffer, text: IYI_CV })
    expect(r.bulgular).toEqual([])
    expect(r.gecenler).toEqual(expect.arrayContaining(["Tek sütun", "Tablo yok", "Metin kutusu yok"]))
  })

  it("bozuk DOCX'te yapısal kontrolleri atlıyor, metin kontrolleri çalışıyor", async () => {
    const r = await checkFormat({ filename: "cv.docx", buffer: Buffer.from("zip değil"), text: IYI_CV })
    expect(r.bulgular).toEqual([])
    expect(r.gecenler).not.toContain("Tek sütun")
  })
})
