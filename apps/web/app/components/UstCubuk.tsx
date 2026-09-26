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
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        borderBottom: "1px solid var(--cizgi)",
        paddingBottom: "0.7rem",
        marginBottom: "1.75rem",
      }}
    >
      <a
        href="/"
        style={{
          fontFamily: "Manrope, sans-serif",
          fontWeight: 800,
          fontSize: "1.1rem",
          color: "var(--metin)",
          textDecoration: "none",
        }}
      >
        uyarla
      </a>

      <nav className="meta" style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
        <a href="/analyze">Yeni analiz</a>
        {/* isPending sırasında hiçbir şey gösterilmiyor: "Giriş yap" gösterip
            sonra e-postaya dönmek göz kırpması yaratıyor. */}
        {isPending ? null : kayitli ? (
          <>
            <span>{kullanici.email}</span>
            <button className="btn-ikincil" onClick={() => void signOut()}>
              Çıkış
            </button>
          </>
        ) : (
          <a href="/login">Giriş yap</a>
        )}
      </nav>
    </header>
  )
}
