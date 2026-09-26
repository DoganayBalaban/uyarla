"use client"

import { useEffect, useState } from "react"
import { useSession } from "@/lib/authClient"
import s from "./landing.module.css"

const BAGLANTILAR = [
  { href: "#nasil", metin: "Nasıl çalışır" },
  { href: "#ozellikler", metin: "Özellikler" },
  { href: "#durustluk", metin: "Dürüstlük" },
  { href: "#sss", metin: "SSS" },
]

/**
 * Tanıtım sayfasının üst çubuğu. Sayfa kaydırılınca zemin ve çizgi
 * beliriyor; en üstte hero ile kaynaşıyor.
 *
 * Anonim oturum giriş sayılmıyor (OturumCubugu ile aynı kural).
 */
export function Gezinme() {
  const { data, isPending } = useSession()
  const [kaydi, setKaydi] = useState(false)
  const [acik, setAcik] = useState(false)

  useEffect(() => {
    const dinle = () => setKaydi(window.scrollY > 8)
    dinle()
    window.addEventListener("scroll", dinle, { passive: true })
    return () => window.removeEventListener("scroll", dinle)
  }, [])

  const kullanici = data?.user
  const kayitli = kullanici && !(kullanici as { isAnonymous?: boolean | null }).isAnonymous

  return (
    <header className={`${s.gezinme} ${kaydi || acik ? s.gezinmeKaydi : ""}`}>
      <div className={`${s.kap} ${s.gezinmeIc}`}>
        <a href="/" className={s.logo} aria-label="uyarla ana sayfa">
          <span className={s.logoSembol} aria-hidden="true">
            <span />
            <span />
          </span>
          uyarla
        </a>

        <nav className={`${s.gezinmeLinkler} ${acik ? s.gezinmeAcik : ""}`} aria-label="Ana menü">
          {BAGLANTILAR.map((b) => (
            <a key={b.href} href={b.href} onClick={() => setAcik(false)}>
              {b.metin}
            </a>
          ))}
          <div className={s.gezinmeMobilEylem}>
            {!isPending && !kayitli && <a href="/login">Giriş yap</a>}
            <a href="/analyze" className={s.btnBirincil}>
              Ücretsiz skorumu gör
            </a>
          </div>
        </nav>

        <div className={s.gezinmeEylem}>
          {!isPending && !kayitli && (
            <a href="/login" className={s.gezinmeGiris}>
              Giriş yap
            </a>
          )}
          <a href="/analyze" className={`${s.btnBirincil} ${s.btnKucuk}`}>
            Ücretsiz skorumu gör
          </a>
        </div>

        <button
          type="button"
          className={s.menuDugme}
          aria-expanded={acik}
          aria-label={acik ? "Menüyü kapat" : "Menüyü aç"}
          onClick={() => setAcik((a) => !a)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  )
}
