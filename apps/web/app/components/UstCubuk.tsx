"use client"

import { signOut, useSession } from "@/lib/authClient"

/**
 * Üst çubuk: logo, gezinme ve oturum durumu.
 *
 * Anonim oturum "giriş yapılmış" sayılmıyor. Kullanıcı açısından o bir oturum
 * değil, işinin kaybolmamasını sağlayan bir iz — üstelik anonim kullanıcının
 * e-postası Better Auth'un ürettiği bir yer tutucu
 * (…@anonymous.placeholder.invalid) ve göstermek kafa karıştırırdı.
 */
export function UstCubuk() {
  const { data, isPending } = useSession()

  const kullanici = data?.user
  const kayitli =
    !isPending && kullanici && !(kullanici as { isAnonymous?: boolean | null }).isAnonymous

  return (
    <header className="mb-7 flex items-center justify-between gap-4 border-b border-cizgi pb-3 dark:border-cizgi-koyu">
      <a href="/" className="font-baslik text-lg font-extrabold no-underline">
        uyarla
      </a>

      <nav className="flex items-center gap-4 text-sm text-gri dark:text-gri-koyu">
        <a href="/analyze" className="hover:text-mavi">
          Yeni analiz
        </a>
        {/* isPending sırasında hiçbir şey gösterilmiyor: "Giriş yap" gösterip
            sonra e-postaya dönmek göz kırpması yaratıyor. */}
        {isPending ? null : kayitli ? (
          <>
            <span>{kullanici.email}</span>
            <button
              className="rounded-buton border border-cizgi px-3 py-1.5 font-semibold dark:border-cizgi-koyu"
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
