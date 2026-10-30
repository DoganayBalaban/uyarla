/** Silme yazarak onaylanıyor (DOG-153): yanlışlıkla basılan düğme yetmesin. */
export const CONFIRM_WORD = "SİL"

/**
 * Yazılan onay kelimesi doğru mu. Noktalı ve noktasız I aynı sayılıyor:
 * İngilizce klavyede "SIL" ya da "sil" yazan kullanıcı takılmasın.
 */
export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim().toLocaleUpperCase("tr-TR").replaceAll("I", "İ") === CONFIRM_WORD
}
