import { Ikon } from "./Ikon"
import s from "./landing.module.css"

/**
 * Fotoğraf gelene kadar yerini tutan kutu.
 *
 * Her yer tutucunun sabit bir `id`'si var (`foto-hero`, `foto-persona-1` …).
 * Fotoğraf geldiğinde bu bileşen aynı oranda bir `next/image` ile
 * değiştirilecek; `aciklama` hangi karenin beklendiğini söylüyor
 * (marka rehberi §9.4: doğal ışık, gerçek mekân, stok takım elbise yok).
 */
export function FotoYeri({
  id,
  oran,
  aciklama,
  className,
}: {
  id: string
  /** CSS aspect-ratio, ör. "4 / 5". */
  oran: string
  aciklama: string
  className?: string
}) {
  return (
    <div
      id={id}
      className={`${s.fotoYeri} ${className ?? ""}`}
      style={{ aspectRatio: oran }}
      role="img"
      aria-label={`Fotoğraf yeri: ${aciklama}`}
    >
      <div className={s.fotoYeriIc}>
        <Ikon ad="resim" boyut={26} />
        <span className={s.fotoYeriEtiket}>{id}</span>
        <span className={s.fotoYeriAciklama}>{aciklama}</span>
        <span className={s.fotoYeriOran}>{oran.replace(/\s/g, "")}</span>
      </div>
    </div>
  )
}
