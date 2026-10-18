import s from "@/features/landing/landing.module.css"

/**
 * Tanıtım sayfasındaki durağan ürün görselleri. Canlı olanlar (hero filmi,
 * gereksinim, uyarlama ve kontrol demoları) `features/landing/demos/` altında.
 */

export function FileChips() {
  return (
    <div className={s.files}>
      <div className={s.file}>
        <span className={`${s.fileType} ${s.filePdf}`}>PDF</span>
        <div>
          <p className={s.fileName}>Ayse_Yilmaz_Frontend.pdf</p>
          <p className={s.mockSmall}>Metni seçilebilir · ATS okur</p>
        </div>
      </div>
      <div className={s.file}>
        <span className={`${s.fileType} ${s.fileDocx}`}>DOCX</span>
        <div>
          <p className={s.fileName}>Ayse_Yilmaz_Frontend.docx</p>
          <p className={s.mockSmall}>Word'de düzenlemeye devam et</p>
        </div>
      </div>
    </div>
  )
}
