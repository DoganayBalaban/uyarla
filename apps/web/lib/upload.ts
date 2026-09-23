import { PermanentError } from "@uyarla/core"

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MIN_JOB_TEXT_LENGTH = 50
const ALLOWED_EXTENSIONS = ["pdf", "docx"]

/**
 * Yükleme doğrulaması. Mesajlar doğrudan kullanıcıya gösteriliyor, bu yüzden
 * marka rehberi §6 tonunda: suçlamayan dil, sonraki adımı gösteren cümle.
 */
export function validateUpload(
  file: { name: string; size: number },
  jobText: string,
): void {
  const parcalar = file.name.toLowerCase().split(".")
  const uzanti = parcalar.length > 1 ? parcalar.pop() : undefined

  if (!uzanti || !ALLOWED_EXTENSIONS.includes(uzanti)) {
    throw new PermanentError(
      "Yalnızca PDF ve DOCX dosyalarını okuyabiliyoruz.",
      "unsupported_format",
    )
  }

  if (file.size === 0) {
    throw new PermanentError(
      "Dosyan boş görünüyor. Tekrar yüklemeyi dener misin?",
      "empty_file",
    )
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new PermanentError(
      "Dosyan 10 MB'tan büyük. Daha küçük bir sürümünü yükler misin?",
      "file_too_large",
    )
  }

  if (jobText.trim().length < MIN_JOB_TEXT_LENGTH) {
    throw new PermanentError(
      "İlan metni çok kısa görünüyor. İlanın tamamını yapıştırır mısın?",
      "job_text_too_short",
    )
  }
}
