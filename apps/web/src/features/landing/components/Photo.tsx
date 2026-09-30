import { existsSync } from "node:fs"
import { join } from "node:path"
import Image from "next/image"
import { FotoYeri } from "@/features/landing/components/PhotoPlaceholder"
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
export function Foto({
  id,
  dosya,
  oran,
  aciklama,
  alt,
  sizes,
  className,
}: {
  id: string
  dosya: string
  /** CSS aspect-ratio, ör. "3 / 4". */
  oran: string
  /** Yer tutucuda gösterilen, beklenen karenin tarifi. */
  aciklama: string
  alt: string
  sizes: string
  className?: string
}) {
  if (!existsSync(join(process.cwd(), "public", "foto", dosya))) {
    return <FotoYeri id={id} oran={oran} aciklama={aciklama} className={className} />
  }
  return (
    <div id={id} className={`${s.fotoKap} ${className ?? ""}`} style={{ aspectRatio: oran }}>
      <Image src={`/foto/${dosya}`} alt={alt} fill sizes={sizes} className={s.fotoKapIc} />
    </div>
  )
}
