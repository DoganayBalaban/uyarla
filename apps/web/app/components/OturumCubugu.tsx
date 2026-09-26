"use client"

import { signOut, useSession } from "@/lib/authClient"

/**
 * Uygulama ekranlarının üst çubuğu: logo, gezinme ve oturum durumu.
 *
 * Anonim oturum "giriş yapılmış" sayılmıyor: kullanıcı açısından o bir oturum
 * değil, sadece işinin kaybolmamasını sağlayan bir iz. Üstelik anonim
 * kullanıcının e-postası Better Auth'un ürettiği bir yer tutucu
 * (…@anonymous.placeholder.invalid) ve gösterilmesi kafa karıştırırdı.
 */
export function OturumCubugu() {
  const { data, isPending } = useSession()

  const kullanici = data?.user
  const kayitli =
    !isPending && kullanici && !(kullanici as { isAnonymous?: boolean | null }).isAnonymous

  return (
    <header className="mb-6 flex items-center justify-between gap-4 border-b border-cizgi pb-2.5">
      <a href="/" className="font-baslik text-lg font-extrabold text-metin no-underline">
        uyarla
      </a>

      <nav className="flex items-center gap-4 text-sm text-gri">
        <a href="/analyze" className="hover:text-mavi">
          Yeni analiz
        </a>
        {/* Yalnızca oturum kısmı bekletiliyor, çubuğun tamamı değil: tümünü
            gizlemek yerleşimi zıplatıyor. "Giriş yap" gösterip sonra
            e-postaya dönmek de göz kırpması yaratıyor. */}
        {isPending ? null : kayitli ? (
          <>
            <span>{kullanici.email}</span>
            <button
              className="rounded-buton border border-cizgi px-3 py-1.5 font-semibold"
              onClick={() => void signOut()}
            >
              Çıkış
            </button>
          </>
        ) : (
          <a href="/login" className="hover:text-mavi">
            Giriş yap
          </a>
        )}
      </nav>
    </header>
  )
}
