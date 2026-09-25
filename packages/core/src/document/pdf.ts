import { fontYollari } from "@uyarla/fonts"
import PDFDocument from "pdfkit"
import type { DocumentModel } from "./model.js"

/** ~2 cm kenar boşluğu. */
const KENAR = 56

/**
 * ATS dostu tek sütunlu PDF (spec §9).
 *
 * Tablo yok, metin kutusu yok, üstbilgi/altbilgi yok, grafik yok. Tarayıcı
 * kullanılmıyor: Puppeteer worker'a yüzlerce megabayt ekler ve bu yerleşim
 * onu gerektirmiyor. pdfkit ile doğrudan yazmak metnin seçilebilir olmasını
 * da garantiliyor — taranmış PDF'e benzer bir sonuç riski yok.
 */
export async function renderPdf(model: DocumentModel): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: KENAR })
  const fontlar = fontYollari()
  doc.registerFont("govde", fontlar.regular)
  doc.registerFont("kalin", fontlar.bold)

  const parcalar: Buffer[] = []
  doc.on("data", (parca: Buffer) => parcalar.push(parca))
  const bitti = new Promise<void>((resolve) => doc.on("end", () => resolve()))

  doc.font("kalin").fontSize(20).text(model.name)
  if (model.contact) {
    doc.font("govde").fontSize(10).fillColor("#444").text(model.contact)
    doc.fillColor("#000")
  }

  if (model.summary) {
    doc.moveDown(0.8).font("govde").fontSize(10).text(model.summary, { align: "left" })
  }

  for (const section of model.sections) {
    doc.moveDown(1).font("kalin").fontSize(11).text(section.title)

    // İnce bir çizgi; grafik değil, bölüm ayracı. Metin katmanını
    // etkilemiyor, ATS tarafında görünmez.
    doc
      .moveTo(KENAR, doc.y + 2)
      .lineTo(doc.page.width - KENAR, doc.y + 2)
      .strokeColor("#999")
      .lineWidth(0.5)
      .stroke()
    doc.moveDown(0.5)

    for (const entry of section.entries) {
      if (entry.heading) doc.font("kalin").fontSize(10).text(entry.heading)
      if (entry.subheading) {
        doc.font("govde").fontSize(9).fillColor("#555").text(entry.subheading)
        doc.fillColor("#000")
      }
      for (const line of entry.lines) {
        doc.font("govde").fontSize(10).text(`• ${line}`, { indent: 8 })
      }
      doc.moveDown(0.5)
    }
  }

  doc.end()
  await bitti
  return Buffer.concat(parcalar)
}
