/** Belgede ad yokken yazılan yer tutucu (core `toDocumentModel`); dosya adına girmemeli. */
const PLACEHOLDER_NAME = "İsimsiz"

const TURKISH: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "I", ö: "o", ş: "s", ü: "u", Ç: "C", Ğ: "G", Ö: "O", Ş: "S", Ü: "U" }

/**
 * İndirilen CV'nin dosya adı: "Ayşe Yılmaz" → `Ayse-Yilmaz-CV.pdf` (DOG-64).
 *
 * Herkesin dosyası `uyarla-cv.pdf` iniyordu; işe alımcının klasöründe
 * adaylar birbirinden ayrılmıyor, ürünün adı adayın adının yerini alıyordu.
 * Türkçe harfler sadeleştiriliyor: bazı ATS'ler ve e-posta istemcileri
 * ASCII dışı dosya adlarını bozuyor.
 */
export function downloadFileName(fullName: string | null | undefined, format: "pdf" | "docx"): string {
  const name = (fullName ?? "").trim()
  const slug =
    name === PLACEHOLDER_NAME
      ? ""
      : name
          .replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TURKISH[c] ?? c)
          .normalize("NFKD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^A-Za-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60)
  return slug ? `${slug}-CV.${format}` : `uyarla-cv.${format}`
}

/**
 * İndirmede sunucunun `Content-Disposition` ile verdiği dosya adı (DOG-74).
 * İstemci bunu `uyarla-cv.pdf` ile eziyordu; DOG-64'teki ad hiç görünmüyordu.
 * Yol parçası atılıyor: ad yalnızca dosya adı olmalı.
 */
export function fileNameFromDisposition(header: string | null | undefined, fallback: string): string {
  const match = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  const name = match?.[1]?.split(/[/\\]/).pop()?.trim()
  return name ? name : fallback
}
