import Link from "next/link"
import { MailX } from "lucide-react"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
      <Card className="mx-auto max-w-lg py-0 shadow-xs">
        <CardContent className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <MailX className="size-6" aria-hidden />
          </span>
          <h1 className="m-0 mt-4 text-2xl font-semibold tracking-tight">E-posta tercihleri</h1>
          {!target || hata ? (
            <p className="mt-4 text-muted-foreground">
              Bu bağlantı geçerli değil ya da eskimiş. E-posta tercihlerini{" "}
              <Link href="/account" className="font-medium text-primary">
                Hesabım
              </Link>{" "}
              sayfasından değiştirebilirsin.
            </p>
          ) : tamam ? (
            <p className="mt-4 text-muted-foreground">
              Kapattık; artık {CATEGORY_LABEL[target.category]} gelmeyecek. Fikrini değiştirirsen{" "}
              <Link href="/account" className="font-medium text-primary">
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
                <Button type="submit">Kapat</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}
