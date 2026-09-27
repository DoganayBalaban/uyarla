import { OturumCubugu } from "../components/OturumCubugu"

/**
 * Uygulama ekranlarının (analiz, uyarlama) ortak çerçevesi.
 *
 * Tanıtım sayfası tam genişlikte kendi gezinme çubuğuyla çiziliyor; dar
 * sütun ve oturum çubuğu yalnızca bu grubun sayfalarına uygulanıyor.
 * Route group adrese girmiyor: /analyze, /adapt/[id]. Giriş ekranı (/login)
 * tam ekran kendi yerleşimiyle çiziliyor, bu grubun dışında.
 */
export default function UygulamaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="uygulama-kap">
      <OturumCubugu />
      {children}
    </div>
  )
}
