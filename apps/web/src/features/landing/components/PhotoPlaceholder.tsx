import { Icon } from "@/features/landing/components/Icon"
import s from "@/features/landing/landing.module.css"

/**
 * Fotoğraf gelene kadar yerini tutan kutu.
 *
 * Her yer tutucunun sabit bir `id`'si var (`foto-hero`, `foto-persona-1` …).
 * Fotoğraf geldiğinde bu bileşen aynı oranda bir `next/image` ile
 * değiştirilecek; `aciklama` hangi karenin beklendiğini söylüyor
 * (marka rehberi §9.4: doğal ışık, gerçek mekân, stok takım elbise yok).
 */
export function PhotoPlaceholder({
  id,
  ratio,
  description,
  className,
}: {
  id: string
  /** CSS aspect-ratio, ör. "4 / 5". */
  ratio: string
  description: string
  className?: string
}) {
  return (
    <div
      id={id}
      className={`${s.fotoYeri} ${className ?? ""}`}
      style={{ aspectRatio: ratio }}
      role="img"
      aria-label={`Fotoğraf yeri: ${description}`}
    >
      <div className={s.fotoYeriIc}>
        <Icon name="image" size={26} />
        <span className={s.fotoYeriEtiket}>{id}</span>
        <span className={s.fotoYeriAciklama}>{description}</span>
        <span className={s.fotoYeriOran}>{ratio.replace(/\s/g, "")}</span>
      </div>
    </div>
  )
}
