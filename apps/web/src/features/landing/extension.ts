/**
 * Chrome eklentisinin tanıtımda kullanılan metinleri (DOG-163). Eklentinin
 * kendi düğme ve menü adları; extension.test.ts eklentinin kaynağıyla
 * karşılaştırıyor. Bağımlılığı yok: tanıtım sayfasının istemci koduna
 * girebilir.
 */

/** Araç çubuğundaki simgenin adı (manifest `action.default_title`). */
export const EXTENSION_ACTION_TITLE = "uyarla'ya gönder"
/** Seçili metinde sağ tık menüsü (background.ts). */
export const EXTENSION_MENU_TITLE = "Seçili metni uyarla ile ölç"

/** Chrome Web Mağazası adresi; yayımlanınca ortam değişkeniyle geliyor. */
export const CHROME_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || null

/** "Chrome'a ekle" düğmesinin hedefi: mağaza adresi yokken hiçbir yere gitmiyor. */
export function storeHref(url: string | null = CHROME_STORE_URL): string {
  return url ?? "#"
}
