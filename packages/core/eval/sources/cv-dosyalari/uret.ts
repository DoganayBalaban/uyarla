import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { fontPaths } from "@uyarla/fonts"
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"
import PDFDocument from "pdfkit"
import { extractText } from "../../../src/documents/extractText.js"

/**
 * Yazılım dışı mesleklerden dört sentetik CV, her biri farklı bir biçimde
 * (DOG-29, DOG-30). Kişiler ve şirketler uydurma; ilanlar gerçek
 * (sources/ilan/ilan-6..9).
 *
 * CV'ler gerçek dosya olarak üretiliyor ve metin ürünün kendi yolundan
 * (`extractText`) çıkarılıyor: sınanan şey biçimin metne nasıl döküldüğü.
 *
 *   cv-d · LinkedIn PDF çıktısı: iki sütun, İngilizce bölüm başlıkları
 *   cv-e · Europass DOCX: solda etiket, sağda içerik olan tablo
 *   cv-f · Tablolu Word şablonu: beceriler ve deneyim tablo hücrelerinde
 *   cv-g · Başlıksız düz metin: kod bölümlemesinin geri çekilme yolu
 *
 * Her CV'de bilinçli tuzaklar var: ilanın terimiyle değil eş anlamlısıyla
 * yazılmış gerçek deneyim (kaçırmayı yakalar) ve ilanın istediği ama CV'de
 * olmayan, yakın görünen beceriler (uydurmayı yakalar).
 *
 * Kullanım: pnpm exec tsx eval/sources/cv-dosyalari/uret.ts
 */
const DIR = import.meta.dirname
const CV_DIR = join(DIR, "..", "cv")

// --- cv-d · LinkedIn PDF -----------------------------------------------------

async function linkedinPdf(): Promise<Buffer> {
  const fonts = fontPaths()
  const doc = new PDFDocument({ size: "A4", margin: 0 })
  doc.registerFont("r", fonts.regular)
  doc.registerFont("b", fonts.bold)
  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))))

  // Sol kenar sütunu (LinkedIn çıktısındaki gri şerit).
  const side = { x: 28, w: 150 }
  let y = 40
  const sideHeading = (t: string) => {
    doc.font("b").fontSize(11).text(t, side.x, y, { width: side.w })
    y = doc.y + 4
  }
  const sideLine = (t: string) => {
    doc.font("r").fontSize(9).text(t, side.x, y, { width: side.w })
    y = doc.y + 2
  }
  sideHeading("Contact")
  sideLine("deniz.aksoy@ornek.com")
  sideLine("www.linkedin.com/in/denizaksoy (LinkedIn)")
  y += 10
  sideHeading("Top Skills")
  sideLine("Performans Pazarlaması")
  sideLine("Google Ads")
  sideLine("Looker Studio")
  y += 10
  sideHeading("Languages")
  sideLine("İngilizce (Professional Working)")
  sideLine("Almanca (Elementary)")
  y += 10
  sideHeading("Certifications")
  sideLine("Google Ads Search Certification")
  sideLine("Google Analytics Certification")

  // Ana sütun.
  const main = { x: 215, w: 350 }
  y = 40
  const text = (t: string, font: "r" | "b", size: number, gap = 2) => {
    doc.font(font).fontSize(size).text(t, main.x, y, { width: main.w })
    y = doc.y + gap
  }
  text("Deniz Aksoy", "b", 22, 2)
  text("Performance Marketing Specialist", "r", 11, 2)
  text("İstanbul, Türkiye", "r", 9, 12)
  text("Summary", "b", 13, 4)
  text(
    "E-ticaret ve ajans tarafında 4 yıllık performans pazarlaması deneyimim var. Meta ve Google reklam " +
      "hesaplarını bütçe, hedef kitle ve kreatif tarafıyla yönetiyor, kararlarımı veriyle veriyorum.",
    "r",
    10,
    12,
  )
  text("Experience", "b", 13, 6)
  text("Moda Sepeti", "b", 11, 1)
  text("Performance Marketing Specialist", "r", 10, 1)
  text("Mart 2023 - Present (2 yıl 7 ay)", "r", 9, 4)
  for (const b of [
    "Facebook ve Instagram reklam kampanyalarını aylık 1,2 milyon TL bütçeyle yönettim.",
    "Google arama ve alışveriş kampanyalarında ROAS'ı 4,1'den 5,3'e çıkardım.",
    "Almanya ve Hollanda pazarları için ayrı hesap yapıları kurup yerel kampanyaları yönettim.",
    "Ürün sayfalarında A/B testleri kurgulayıp sepete ekleme oranını %18 artırdım.",
    "GA4 ve Looker Studio ile haftalık performans panolarını hazırladım.",
  ])
    text(`• ${b}`, "r", 9.5, 2)
  y += 8
  text("Parlak Dijital Ajans", "b", 11, 1)
  text("Digital Marketing Executive", "r", 10, 1)
  text("Eylül 2021 - Şubat 2023 (1 yıl 6 ay)", "r", 9, 4)
  for (const b of [
    "Perakende ve otomotiv müşterileri için arama ve sosyal medya reklamlarını yönettim.",
    "Google Tag Manager ile dönüşüm takibi kurulumlarını yaptım.",
    "Kreatif ekiple haftalık toplantılar düzenleyip reklam görsellerinin üretim sürecini takip ettim.",
    "Müşteri işlerini Trello üzerinden planlayıp takip ettim.",
  ])
    text(`• ${b}`, "r", 9.5, 2)
  y += 8
  text("Education", "b", 13, 6)
  text("Marmara Üniversitesi", "b", 11, 1)
  text("Lisans, İşletme · (2017 - 2021)", "r", 9.5, 2)

  doc.end()
  return done
}

// --- DOCX yardımcıları -------------------------------------------------------

const FONT = "Arial"
const run = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
  new TextRun({ text, font: FONT, bold: opts.bold, size: opts.size ?? 20 })
const para = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
  new Paragraph({ children: [run(text, opts)] })
const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
}
function cell(children: Paragraph[], width: number, borders = NO_BORDER) {
  return new TableCell({ children, width: { size: width, type: WidthType.PERCENTAGE }, borders })
}

// --- cv-e · Europass DOCX ----------------------------------------------------

async function europassDocx(): Promise<Buffer> {
  // Europass düzeni: her satırda solda gri etiket, sağda içerik.
  const row = (label: string, content: Paragraph[]) =>
    new TableRow({
      children: [
        cell([new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(label, { size: 18 })] })], 25),
        cell(content, 75),
      ],
    })
  const job = (dates: string, title: string, org: string, bullets: string[]) => [
    row(dates, [para(title, { bold: true }), para(org), ...bullets.map((b) => para(`▪ ${b}`))]),
  ]

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row("KİŞİSEL BİLGİLER", [para("Ece Yıldırım", { bold: true, size: 28 })]),
      row("", [para("Kadıköy, İstanbul (Türkiye)")]),
      row("", [para("+90 5XX XXX XX XX    ece.yildirim@ornek.com")]),
      row("İŞ DENEYİMİ", []),
      ...job("01/2022 – Halen", "Genel Muhasebe Uzmanı", "Atlas Lojistik A.Ş., İstanbul", [
        "Alış ve satış faturalarının Logo Tiger üzerinde kaydını ve kontrolünü yapıyorum.",
        "Aylık KDV ve Muhtasar beyannameleri için verileri hazırlıyorum.",
        "Banka ve cari hesap mutabakatlarını aylık olarak yürütüyorum.",
        "Ay sonu kapanışında mizan kontrollerini ve gider tahakkuklarını hazırlıyorum.",
        "e-Fatura ve e-Arşiv süreçlerinin günlük takibini yapıyorum.",
      ]),
      ...job("07/2020 – 12/2021", "Muhasebe Uzman Yardımcısı", "Kuzey Gıda Ltd. Şti., Kocaeli", [
        "Kasa ve banka hareketlerini sisteme işledim.",
        "Masraf belgelerini sınıflandırıp arşivledim.",
        "Bağımsız denetim döneminde istenen belgelerin hazırlanmasına destek verdim.",
      ]),
      row("EĞİTİM VE ÖĞRETİM", []),
      row("2016 – 2020", [para("Lisans, İktisat", { bold: true }), para("Anadolu Üniversitesi, Eskişehir")]),
      row("KİŞİSEL BECERİLER", []),
      row("Ana dil", [para("Türkçe")]),
      row("Diğer dil(ler)", [para("İngilizce — Okuma B1, Konuşma A2, Yazma B1")]),
      row("Dijital beceriler", [para("MS Excel (pivot tablo, DÜŞEYARA), Logo Tiger, e-Fatura portalı")]),
      row("Sertifikalar", [para("SMMM Staj Başlangıç Sınavı (2021)")]),
    ],
  })
  return Packer.toBuffer(new Document({ sections: [{ children: [table] }] }))
}

// --- cv-f · Tablolu Word şablonu ---------------------------------------------

async function tableTemplateDocx(): Promise<Buffer> {
  const bordered = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
  }
  const grid = (rows: string[][], widths: number[]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows.map(
        (r, i) =>
          new TableRow({
            children: r.map((c, j) => cell([para(c, { bold: i === 0 })], widths[j]!, bordered)),
          }),
      ),
    })

  return Packer.toBuffer(
    new Document({
      sections: [
        {
          children: [
            para("MERT KAYA", { bold: true, size: 32 }),
            para("Satış Mühendisi · Pendik, İstanbul · mert.kaya@ornek.com · 05XX XXX XX XX"),
            para(""),
            para("PROFİL", { bold: true, size: 24 }),
            para(
              "Makine mühendisiyim. Üç yıldır iş makinesi sektöründe saha satışı yapıyorum; inşaat ve " +
                "madencilik firmalarına yeni ve ikinci el ekipman satışı ve kiralama tekliflerini hazırlıyorum.",
            ),
            para(""),
            para("İŞ DENEYİMİ", { bold: true, size: 24 }),
            grid(
              [
                ["Tarih", "Pozisyon / Firma", "Sorumluluklar"],
                [
                  "2022 – Halen",
                  "Saha Satış Mühendisi\nAnadolu İş Makinaları (Komatsu bayisi)",
                  "Anadolu yakası ve Kocaeli bölgesinde 60 müşteriyi düzenli ziyaret ettim. " +
                    "Ekskavatör ve yükleyici için teklif hazırlayıp yıllık satış hedefinin %112'sini gerçekleştirdim. " +
                    "Taş ocağı ve agrega firmalarına kiralama çözümleri sundum. " +
                    "Müşteri görüşmelerini ve fırsatları Salesforce'a girdim.",
                ],
                [
                  "2021 – 2022",
                  "Satış Sonrası Hizmetler Uzmanı\nYıldız Makina",
                  "Servis taleplerini karşılayıp yedek parça tekliflerini hazırladım. " +
                    "Müşteri şikâyetlerini teknik ekiple birlikte çözdüm.",
                ],
              ],
              [16, 28, 56],
            ),
            para(""),
            para("EĞİTİM", { bold: true, size: 24 }),
            grid(
              [
                ["Yıl", "Okul", "Bölüm"],
                ["2016 – 2021", "Yıldız Teknik Üniversitesi", "Makine Mühendisliği (Lisans)"],
              ],
              [16, 42, 42],
            ),
            para(""),
            para("YETKİNLİKLER", { bold: true, size: 24 }),
            grid(
              [
                ["Alan", "Düzey"],
                ["İngilizce", "B2 (iyi)"],
                ["MS Office (Excel, PowerPoint)", "İleri"],
                ["Salesforce CRM", "Orta"],
                ["Sürücü belgesi", "B sınıfı, aktif"],
              ],
              [60, 40],
            ),
          ],
        },
      ],
    }),
  )
}

// --- cv-g · Başlıksız düz metin ----------------------------------------------

/** Bölüm başlığı hiç yok: kod bölümlemesi ham metni her bloğa veriyor (K-22). */
const HEADERLESS_TEXT = `Selin Demir
İnsan Kaynakları Uzmanı · Gebze, Kocaeli · selin.demir@ornek.com

Otomotiv yan sanayinde 4 yıldır insan kaynaklarının işe alım, özlük ve eğitim süreçlerinde çalışıyorum. Üretim ortamında mavi yaka ağırlıklı ekiplerle çalışmaya alışkınım.

Kocaeli Otomotiv Parçaları A.Ş. — İnsan Kaynakları Uzmanı — 2023'ten beri
Mavi ve beyaz yaka pozisyonlar için ilan hazırlığından teklif aşamasına kadar işe alım süreçlerini yürütüyorum; yılda ortalama 120 işe alım yapıyoruz.
Yeni başlayanlar için oryantasyon programını yeniden tasarladım ve ilk üç aydaki ayrılma oranını %22'den %14'e indirdim.
SGK işe giriş-çıkış bildirgelerini, özlük dosyalarını ve izin kayıtlarını takip ediyorum.
Yıllık performans değerlendirme dönemini bölüm yöneticileriyle birlikte koordine ediyorum.
Aylık devamsızlık ve personel hareketleri raporlarını Excel'de hazırlayıp fabrika müdürüne sunuyorum.
Puantaj verilerini fabrikadaki PDKS sistemi üzerinden kontrol ediyorum.

Marmara Kablo San. — İnsan Kaynakları Uzman Yardımcısı — 2021-2023
Kariyer.net ve LinkedIn üzerinden aday taraması yaptım, ön görüşmeleri yürüttüm.
Disiplin kurulu toplantılarının tutanaklarını ve ihtar yazılarını hazırladım.
Müşteri denetimleri öncesinde İK dokümantasyonunu güncelledim.

Kocaeli Üniversitesi, Çalışma Ekonomisi ve Endüstri İlişkileri, Lisans, 2017-2021
4857 sayılı İş Kanunu ve SGK mevzuatı eğitimi, 2022
İngilizce: orta seviye (B1)
MS Office: Excel, Word, PowerPoint
`

async function main() {
  const files: Array<{ id: string; file: string; buffer: Buffer }> = [
    { id: "cv-d-pazarlama", file: "cv-d-pazarlama.pdf", buffer: await linkedinPdf() },
    { id: "cv-e-muhasebe", file: "cv-e-muhasebe.docx", buffer: await europassDocx() },
    { id: "cv-f-satis", file: "cv-f-satis.docx", buffer: await tableTemplateDocx() },
  ]
  for (const { id, file, buffer } of files) {
    writeFileSync(join(DIR, file), buffer)
    writeFileSync(join(CV_DIR, `${id}.txt`), await extractText(buffer, file))
    console.log(`${id}: ${file} → cv/${id}.txt`)
  }
  writeFileSync(join(CV_DIR, "cv-g-ik.txt"), HEADERLESS_TEXT)
  console.log("cv-g-ik: düz metin → cv/cv-g-ik.txt")
}

void main()
