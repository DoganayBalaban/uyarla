import mammoth from "mammoth"
import { PermanentError } from "../errors.js"

/**
 * Bu uzunluğun altındaki PDF metni, metin katmanı yok sayılır.
 * Taranmış belgeler tümüyle boş dönmeyebilir; gömülü üstbilgi ya da
 * damgadan birkaç karakter sızabiliyor.
 */
const SCANNED_PDF_THRESHOLD = 20

const UNREADABLE_MESSAGE =
  "Dosyanı okuyamadık. PDF veya DOCX olarak tekrar yüklemeyi dener misin?"

export async function extractText(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop()

  if (ext === "pdf") return extractFromPdf(buffer)
  if (ext === "docx") return extractFromDocx(buffer)

  throw new PermanentError(
    "Yalnızca PDF ve DOCX dosyalarını okuyabiliyoruz.",
    "unsupported_format",
  )
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  // Tembel yükleniyor: pdf-parse'ın ESM derlemesi (pdfjs-dist) Next'in
  // sunucu katmanında değerlendirilemiyor ("Object.defineProperty called on
  // non-object"). Üst seviyede import edilirse @uyarla/core'u import eden
  // her Next dosyası bu hatayı alır. Ayrıca pdfjs ağır bir bağımlılık;
  // yalnızca PDF işlenirken yüklenmesi doğru.
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: buffer })
  let text: string
  try {
    text = (await parser.getText()).text.trim()
  } catch {
    throw new PermanentError(UNREADABLE_MESSAGE, "unreadable_file")
  } finally {
    // pdfjs arka planda çalışan bir görev tutuyor; bırakılmazsa süreç kapanmaz.
    await parser.destroy()
  }

  if (text.length < SCANNED_PDF_THRESHOLD) {
    // Ayrı mesaj şart: "okuyamadık" diyen bir hata kullanıcıyı aynı dosyayı
    // tekrar yüklemeye iter ve aynı sonucu alır.
    throw new PermanentError(
      "Bu PDF taranmış bir görüntü, içinde seçilebilir metin yok. " +
        "CV'ni Word veya metin katmanı olan bir PDF olarak yükler misin?",
      "scanned_pdf",
    )
  }

  return text
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer })
    return value.trim()
  } catch {
    throw new PermanentError(UNREADABLE_MESSAGE, "unreadable_file")
  }
}
