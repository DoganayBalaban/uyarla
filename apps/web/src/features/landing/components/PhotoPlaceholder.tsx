import { Icon } from "@/features/landing/components/Icon"
import s from "@/features/landing/landing.module.css"

/**
 * Fotoğraf gelene kadar yerini tutan kutu.
 *
 * Her yer tutucunun sabit bir `id`'si var (`photo-output`, `photo-persona-1` …).
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
      className={`${s.photoPlaceholder} ${className ?? ""}`}
      style={{ aspectRatio: ratio }}
      role="img"
      aria-label={`Fotoğraf yeri: ${description}`}
    >
      <div className={s.photoPlaceholderInner}>
        <Icon name="image" size={26} />
        <span className={s.photoPlaceholderLabel}>{id}</span>
        <span className={s.photoPlaceholderDescription}>{description}</span>
        <span className={s.photoPlaceholderRatio}>{ratio.replace(/\s/g, "")}</span>
      </div>
    </div>
  )
}
