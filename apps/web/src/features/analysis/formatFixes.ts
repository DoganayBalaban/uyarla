/**
 * ATS bulgusunun indirilen CV'de ne olacağı (DOG-58). İndirilen PDF/DOCX
 * profilden sıfırdan üretiliyor (tek sütun, tablo ve üst/alt bilgi yok);
 * iletişim satırı hesaptaki e-posta ve telefonla tamamlanıyor.
 *
 * - export: indirilen CV'de kendiliğinden düzelir.
 * - contact: hesaptaki bilgiyle eklenir.
 * - action: kullanıcının bir şey eklemesi gerekir.
 * İçerik sorunları (tarih yok, çok kısa…) için ipucu yok: onları yalnızca
 * kullanıcı düzeltebilir ve bulgunun kendi metni zaten yolu gösteriyor.
 */
export type FixKind = "export" | "contact" | "action"

const EXPORT_FIXED = new Set(["table", "header_footer", "multiple_columns", "text_box", "image", "icon_characters", "column_hint"])

export function fixHint(code: string): { kind: FixKind; text: string; href?: string } | null {
  if (EXPORT_FIXED.has(code)) return { kind: "export", text: "İndirdiğin uyarlanmış CV'de düzelir." }
  if (code === "email_missing" || code === "email_in_header") {
    return { kind: "contact", text: "İndirdiğin CV'ye hesabındaki e-posta eklenir." }
  }
  if (code === "phone_missing") {
    return { kind: "action", text: "Telefonunu Hesabım'dan eklersen indirdiğin CV'ye yazılır.", href: "/account" }
  }
  return null
}
