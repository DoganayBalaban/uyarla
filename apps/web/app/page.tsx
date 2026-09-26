/**
 * Landing. Metinler marka rehberi §10.1'den birebir alındı.
 *
 * Giriş yapmış kullanıcıya da bu sayfa görünüyor; yönlendirme kuralı yok.
 * Üst çubuk zaten içeri götürüyor ve sürpriz bir atlama olmuyor.
 */
export default function LandingPage() {
  return (
    <main>
      <section className="max-w-xl py-8">
        <h1 className="text-5xl leading-tight">Her ilana, doğru CV.</h1>

        <p className="mt-4 text-lg">
          İlanı yapıştır, CV&apos;nin ne kadar uyduğunu gör ve tek tıkla ilana özel
          hâle getir. Deneyimini uydurmadan.
        </p>

        {/* Birincil eylem her ekranda tek ve Uyarla Mavisi (rehber §9.5). */}
        <p className="mt-7">
          <a
            href="/analyze"
            className="inline-block rounded-buton bg-mavi px-6 py-3 font-semibold text-white no-underline"
          >
            Ücretsiz skorumu gör
          </a>
        </p>

        <p className="mt-5 text-sm text-gri dark:text-gri-koyu">
          Kayıt gerekmez · CV&apos;n izinsiz paylaşılmaz · İstediğin an silebilirsin
        </p>
      </section>

      <section className="mt-10 max-w-xl">
        <h2 className="mb-3 text-lg">Nasıl çalışıyor</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-gri dark:text-gri-koyu">
          <li>
            <strong className="text-gece dark:text-metin-koyu">Skorunu gör.</strong>{" "}
            CV&apos;ni yükle, ilanı yapıştır. Hangi gereksinimi karşıladığını ve
            neyin eksik olduğunu maddeler hâlinde görürsün.
          </li>
          <li>
            <strong className="text-gece dark:text-metin-koyu">
              Uyarlamayı incele.
            </strong>{" "}
            Her madde için önce/sonra yan yana. Uydurma şüphesi olan her
            değişiklik işaretli ve gerekçeli.
          </li>
          <li>
            <strong className="text-gece dark:text-metin-koyu">İndir.</strong> ATS
            dostu PDF veya Word. Sadece onayladığın hâliyle.
          </li>
        </ol>
      </section>
    </main>
  )
}
