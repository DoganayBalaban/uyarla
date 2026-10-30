/**
 * Chrome eklentisinin tanıtımda kullanılan metinleri (DOG-163). Eklentinin
 * kendi düğme ve menü adları; extension.test.ts eklentinin kaynağıyla
 * karşılaştırıyor. Bağımlılığı yok: tanıtım sayfasının istemci koduna
 * girebilir.
 */

/** Araç çubuğundaki simgenin adı (manifest `action.default_title`); basınca menü açılıyor (DOG-169). */
export const EXTENSION_ACTION_TITLE = "uyarla"
/** İlan sayfasında, sitenin başvuru düğmesinin yanındaki düğme (content.ts, DOG-169). */
export const EXTENSION_PAGE_BUTTON = "CV'mi bu ilana uyarla"
/** Kendi LinkedIn profilindeki düğme (content.ts, DOG-169). */
export const EXTENSION_PROFILE_BUTTON = "Profilimi uyarla ile denetle"
/** Seçili metinde sağ tık menüsü (background.ts). */
export const EXTENSION_MENU_TITLE = "Seçili metni uyarla ile ölç"

/** Chrome Web Mağazası adresi; yayımlanınca ortam değişkeniyle geliyor. */
export const CHROME_STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_STORE_URL || null

/** "Chrome'a ekle" düğmesinin hedefi: mağaza adresi yokken hiçbir yere gitmiyor. */
export function storeHref(url: string | null = CHROME_STORE_URL): string {
  return url ?? "#"
}
