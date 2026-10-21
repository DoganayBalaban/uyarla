import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { CATEGORY_LABEL, verifyUnsubscribe } from "@/server/email/unsubscribe"

export const metadata = { title: "E-posta tercihleri · uyarla", robots: { index: false } }

/**
 * E-postanın altındaki "tek tıkla kapat" bağlantısı (DOG-127). Giriş
 * istemiyor; bağlantı imzalı. Sayfa açılınca bir şey kapanmıyor, düğmeyle
 * onaylanıyor: e-posta tarayıcıları bağlantıları önceden açabiliyor.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; tamam?: string; hata?: string }>
}) {
  const { t, tamam, hata } = await searchParams
  const target = verifyUnsubscribe(t, process.env.EMAIL_LINK_SECRET)

  return (
    <PageShell width="narrow">
      <h1 className="font-heading text-3xl font-extrabold tracking-tight">E-posta tercihleri</h1>
      {!target || hata ? (
        <p className="mt-4 text-muted-foreground">
          Bu bağlantı geçerli değil ya da eskimiş. E-posta tercihlerini{" "}
          <Link href="/account" className="font-medium text-brand-blue">
            Hesabım
          </Link>{" "}
          sayfasından değiştirebilirsin.
        </p>
      ) : tamam ? (
        <p className="mt-4 text-muted-foreground">
          Kapattık; artık {CATEGORY_LABEL[target.category]} gelmeyecek. Fikrini değiştirirsen{" "}
          <Link href="/account" className="font-medium text-brand-blue">
            Hesabım
          </Link>{" "}
          sayfasından yeniden açabilirsin.
        </p>
      ) : (
        <>
          <p className="mt-4 text-muted-foreground">
            {CATEGORY_LABEL[target.category].replace(/^./, (c) => c.toLocaleUpperCase("tr"))} kapatılsın mı? Giriş
            bağlantısı gibi hesabınla ilgili zorunlu e-postalar gelmeye devam eder.
          </p>
          <form method="post" action={`/api/email/unsubscribe?t=${encodeURIComponent(t!)}`} className="mt-6">
            <button
              type="submit"
              className="rounded-button bg-brand-blue px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-blue/90"
            >
              Kapat
            </button>
          </form>
        </>
      )}
    </PageShell>
  )
}
