import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import { checkFormat } from "./check.js"

const GOOD_RESUME = `Elif Yılmaz
Frontend Geliştirici
elif@ornek.com · +90 532 111 22 33 · linkedin.com/in/elif

Özet
React ve TypeScript ile arayüz geliştiren bir geliştiriciyim.

Deneyim
Acme Yazılım — Frontend Geliştirici (03/2022 – Günümüz)
${"React ile müşteri paneli geliştirdim ve yükleme süresini %40 kısalttım. ".repeat(20)}

Eğitim
İstanbul Üniversitesi, Bilgisayar Mühendisliği (2016 – 2020)

Beceriler
React, TypeScript, Jest, Git`

async function docx(body: string, suffixList: Record<string, string> = {}): Promise<Buffer> {
  const zip = new JSZip()
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document><w:body>${body}</w:body></w:document>`,
  )
  for (const [name, contentText] of Object.entries(suffixList)) zip.file(name, contentText)
  return zip.generateAsync({ type: "nodebuffer" })
}

const codes = (r: { findings: { code: string }[] }) => r.findings.map((b) => b.code)

describe("checkFormat · text", () => {
  it("no findings for a well-formed resume", async () => {
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text: GOOD_RESUME })
    expect(r.findings).toEqual([])
    expect(r.passed).toContain("Deneyim başlığı")
  })

  it("reports missing email and phone", async () => {
    const text = GOOD_RESUME.replace("elif@ornek.com · +90 532 111 22 33", "")
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(codes(r)).toEqual(expect.arrayContaining(["email_missing", "phone_missing"]))
    // Sorunlar uyarılardan önce geliyor.
    expect(r.findings[0]!.severity).toBe("problem")
  })

  it("does not treat a hyphenated year range as a phone", async () => {
    const text = GOOD_RESUME.replace(" · +90 532 111 22 33", "").replace("2016 – 2020", "2016 - 2020")
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(codes(r)).toContain("phone_missing")
  })

  it.each(["0532 111 22 33", "+90 (532) 111-22-33", "05321112233"])("%s counts as a phone", async (phone) => {
    const text = GOOD_RESUME.replace("+90 532 111 22 33", phone)
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(codes(r)).not.toContain("phone_missing")
  })

  it("does not recognize a non-standard experience heading", async () => {
    const text = GOOD_RESUME.replace("\nDeneyim\n", "\nYolculuğum\n")
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(codes(r)).toContain("baslik_yok_experience")
  })

  it("treats consecutive headings as a sign of columns", async () => {
    const text = GOOD_RESUME.replace("Özet\nReact ve TypeScript ile", "Özet\nDeneyim\nReact ve TypeScript ile")
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(codes(r)).toContain("column_hint")
  })

  it("warns when dates are missing, content is short or icon characters are present", async () => {
    const text = "Ali\nali@ornek.com 0532 111 22 33\nDeneyim\nAcme\nEğitim\nOkul\nBeceriler\nReact"
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text: text + "   " })
    expect(codes(r)).toEqual(expect.arrayContaining(["dates_missing", "too_short", "icon_characters"]))
  })
})

describe("checkFormat · DOCX structure", () => {
  it("finds text boxes, multiple columns, tables, headers and images", async () => {
    const buffer = await docx(
      `<w:tbl><w:tr/></w:tbl><w:txbxContent/><w:sectPr><w:cols w:num="2"/></w:sectPr>`,
      {
        "word/header1.xml": "<w:hdr><w:p><w:r><w:t>Elif Yılmaz</w:t></w:r></w:p></w:hdr>",
        "word/media/image1.png": "x",
      },
    )
    const r = await checkFormat({ filename: "cv.docx", buffer, text: GOOD_RESUME })
    expect(codes(r)).toEqual(
      expect.arrayContaining(["text_box", "multiple_columns", "table", "header_footer", "image"]),
    )
    expect(r.findings.find((b) => b.code === "multiple_columns")!.title).toBe("2 sütunlu sayfa düzeni")
  })

  it("reports separately when the email is only in the header", async () => {
    const buffer = await docx("<w:p/>", {
      "word/header1.xml": "<w:hdr><w:t>elif@ornek.com</w:t></w:hdr>",
    })
    const text = GOOD_RESUME.replace("elif@ornek.com · ", "")
    const r = await checkFormat({ filename: "cv.docx", buffer, text })
    expect(codes(r)).toContain("email_in_header")
    expect(codes(r)).not.toContain("email_missing")
    expect(codes(r)).not.toContain("header_footer")
  })

  it("no structural findings for a clean DOCX", async () => {
    const buffer = await docx("<w:p><w:r><w:t>metin</w:t></w:r></w:p>")
    const r = await checkFormat({ filename: "cv.docx", buffer, text: GOOD_RESUME })
    expect(r.findings).toEqual([])
    expect(r.passed).toEqual(expect.arrayContaining(["Tek sütun", "Tablo yok", "Metin kutusu yok"]))
  })

  it("skips structural checks for a corrupt DOCX while text checks still run", async () => {
    const r = await checkFormat({ filename: "cv.docx", buffer: Buffer.from("zip değil"), text: GOOD_RESUME })
    expect(r.findings).toEqual([])
    expect(r.passed).not.toContain("Tek sütun")
  })
})

describe("checkFormat · content", () => {
  const withExperience = (experience: string) => GOOD_RESUME.replace(/Deneyim\n[\s\S]*?\n\nEğitim/, `Deneyim\n${experience}\n\nEğitim`)

  it("warns when few experience statements carry a number, with examples to fix", async () => {
    const text = withExperience(
      [
        "Acme Yazılım — Frontend Geliştirici (03/2022 – Günümüz)",
        "• Müşteri paneli için yeni bir tasarım sistemi kurdum.",
        "• Test altyapısını sıfırdan hazırlayıp ekibe öğrettim.",
        "• Ödeme sayfasını yeniden yazarak hataları azalttım.",
        "• Sayfa yükleme süresini %40 kısalttım.",
      ].join("\n"),
    )
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    const finding = r.findings.find((b) => b.code === "few_measurable_results")
    expect(finding).toMatchObject({ severity: "warning", group: "content" })
    expect(finding!.title).toContain("4 deneyim cümlesinden 1 tanesinde")
    expect(finding!.examples).toEqual([
      "Müşteri paneli için yeni bir tasarım sistemi kurdum.",
      "Test altyapısını sıfırdan hazırlayıp ekibe öğrettim.",
      "Ödeme sayfasını yeniden yazarak hataları azalttım.",
    ])
  })

  it("passes when at least a third of statements are quantified", async () => {
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text: GOOD_RESUME })
    expect(r.passed).toContain("Ölçülebilir sonuçlar")
  })

  it("says none rather than zero when no statement has a number", async () => {
    const text = withExperience(
      ["• Müşteri paneli için yeni bir tasarım sistemi kurdum.", "• Test altyapısını sıfırdan hazırlayıp ekibe öğrettim.", "• Ödeme sayfasını yeniden yazdım."].join("\n"),
    )
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(r.findings.find((b) => b.code === "few_measurable_results")!.title).toBe(
      "Ölçülebilir sonuç yok: 3 deneyim cümlesinin hiçbirinde rakam geçmiyor",
    )
  })

  it("stays silent when experience is too thin to judge", async () => {
    const text = withExperience("Acme Yazılım — Stajyer (2023)\nArayüz testleri yazdım.")
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(codes(r)).not.toContain("few_measurable_results")
    expect(r.passed).not.toContain("Ölçülebilir sonuçlar")
  })
})

describe("checkFormat · projects (DOG-105)", () => {
  it("accepts a projects section in place of an experience heading", async () => {
    const text = GOOD_RESUME.replace(/Deneyim\n/, "Projeler\n")
    const r = await checkFormat({ filename: "cv.pdf", buffer: Buffer.from(""), text })
    expect(codes(r)).not.toContain("baslik_yok_experience")
    expect(r.passed).toContain("Deneyim başlığı")
  })
})
