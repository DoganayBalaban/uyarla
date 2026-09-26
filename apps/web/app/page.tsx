/**
 * Landing. Metinler marka rehberi §10.1'den birebir alındı.
 *
 * Giriş yapmış kullanıcıya da bu sayfa görünüyor; yönlendirme kuralı yok.
 * Üst çubuk zaten içeri götürüyor ve sürpriz bir atlama olmuyor.
 */
export default function LandingPage() {
  return (
    <main>
      <section style={{ maxWidth: "34rem", padding: "2rem 0 1rem" }}>
        <h1 style={{ fontSize: "2.6rem", lineHeight: 1.1 }}>Her ilana, doğru CV.</h1>

        <p style={{ fontSize: "1.05rem", marginTop: "1rem" }}>
          İlanı yapıştır, CV&apos;nin ne kadar uyduğunu gör ve tek tıkla ilana özel
          hâle getir. Deneyimini uydurmadan.
        </p>

        <p style={{ marginTop: "1.75rem" }}>
          <a className="btn-birincil" href="/analyze" style={{ textDecoration: "none" }}>
            Ücretsiz skorumu gör
          </a>
        </p>

        <p className="meta" style={{ marginTop: "1.25rem" }}>
          Kayıt gerekmez · CV&apos;n izinsiz paylaşılmaz · İstediğin an silebilirsin
        </p>
      </section>

      <section style={{ marginTop: "2.5rem", maxWidth: "34rem" }}>
        <h2>Nasıl çalışıyor</h2>
        <ol className="meta" style={{ paddingLeft: "1.2rem", lineHeight: 1.9 }}>
          <li>
            <strong style={{ color: "var(--metin)" }}>Skorunu gör.</strong> CV&apos;ni
            yükle, ilanı yapıştır. Hangi gereksinimi karşıladığını ve neyin eksik
            olduğunu maddeler hâlinde görürsün.
          </li>
          <li>
            <strong style={{ color: "var(--metin)" }}>Uyarlamayı incele.</strong> Her
            madde için önce/sonra yan yana. Uydurma şüphesi olan her değişiklik
            işaretli ve gerekçeli.
          </li>
          <li>
            <strong style={{ color: "var(--metin)" }}>İndir.</strong> ATS dostu PDF
            veya Word. Sadece onayladığın hâliyle.
          </li>
        </ol>
      </section>
    </main>
  )
}
