import { existsSync } from "node:fs"
import { join } from "node:path"
import Image from "next/image"
import { PhotoPlaceholder as PhotoPlaceholder } from "@/features/landing/components/PhotoPlaceholder"
import s from "@/features/landing/landing.module.css"

/**
 * Tanıtım sayfasının fotoğrafı: `public/foto/<dosya>` varsa onu, yoksa yer
 * tutucuyu çiziyor. Kontrol derleme anında yapılıyor (sayfa statik); dosya
 * eklenince yeniden derlemek yetiyor. Fotoğraflar Higgsfield'da (Soul 2.0,
 * Seedream 5.0 Lite) üretildi ve `scripts/download-photos.mjs` ile indiriliyor.
 *
 * Görsel kutunun oranına `object-fit: cover` ile oturuyor; üretilen karenin
 * oranı yer tutucununkinden biraz farklı olabilir (ör. 4:3 ↔ 5:4).
 */
export function Photo({
  id,
  file,
  ratio,
  description,
  alt,
  sizes,
  className,
}: {
  id: string
  file: string
  /** CSS aspect-ratio, ör. "3 / 4". */
  ratio: string
  /** Yer tutucuda gösterilen, beklenen karenin tarifi. */
  description: string
  alt: string
  sizes: string
  className?: string
}) {
  if (!existsSync(join(process.cwd(), "public", "foto", file))) {
    return <PhotoPlaceholder id={id} ratio={ratio} description={description} className={className} />
  }
  return (
    <div id={id} className={`${s.fotoKap} ${className ?? ""}`} style={{ aspectRatio: ratio }}>
      <Image src={`/foto/${file}`} alt={alt} fill sizes={sizes} className={s.fotoKapIc} />
    </div>
  )
}
