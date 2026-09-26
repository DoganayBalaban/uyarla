"use client"

import { signOut, useSession } from "@/lib/authClient"

/**
 * Kim giriş yapmış ve çıkış bağlantısı.
 *
 * Anonim oturum "giriş yapılmış" sayılmıyor: kullanıcı açısından o bir oturum
 * değil, sadece işinin kaybolmamasını sağlayan bir iz. Üstelik anonim
 * kullanıcının e-postası Better Auth'un ürettiği bir yer tutucu
 * (…@anonymous.placeholder.invalid) ve gösterilmesi kafa karıştırırdı.
 */
export function OturumCubugu() {
  const { data, isPending } = useSession()
  if (isPending) return null

  const kullanici = data?.user
  const kayitli = kullanici && !(kullanici as { isAnonymous?: boolean | null }).isAnonymous

  return (
    <div
      className="meta"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        borderBottom: "1px solid var(--cizgi)",
        paddingBottom: "0.6rem",
        marginBottom: "1.5rem",
      }}
    >
      <a
        href="/test"
        style={{
          fontFamily: "Manrope, sans-serif",
          fontWeight: 800,
          color: "var(--metin)",
          textDecoration: "none",
        }}
      >
        uyarla
      </a>
      {kayitli ? (
        <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {kullanici.email}
          <button className="btn-ikincil" onClick={() => void signOut()}>
            Çıkış
          </button>
        </span>
      ) : (
        <a href="/giris">Giriş yap</a>
      )}
    </div>
  )
}
