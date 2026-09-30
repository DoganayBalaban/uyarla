"use client"

import { useState } from "react"
import { signIn } from "@/lib/authClient"
import { loginPath } from "@/lib/returnPath"
import type { Provider } from "@/features/auth/providers"

const ETIKET: Record<Provider, string> = {
  google: "Google",
  linkedin: "LinkedIn",
  github: "GitHub",
}

/** Marka ikonları; her sağlayıcının kendi logosu, kendi renginde. */
function SaglayiciIkon({ s }: { s: Provider }) {
  if (s === "google") {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
      </svg>
    )
  }
  if (s === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <rect width="24" height="24" rx="4" fill="#0A66C2" />
        <path
          fill="#fff"
          d="M7.1 9.5h2.5v8H7.1zM8.35 5.5a1.45 1.45 0 1 1 0 2.9 1.45 1.45 0 0 1 0-2.9zM11.2 9.5h2.4v1.1h.03c.34-.63 1.15-1.3 2.37-1.3 2.53 0 3 1.67 3 3.83v4.37h-2.5v-3.88c0-.93-.02-2.12-1.29-2.12-1.3 0-1.5 1.01-1.5 2.05v3.95h-2.5z"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="size-5 text-metin" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  )
}

/**
 * Google, LinkedIn ve GitHub butonları.
 *
 * Kimlik bilgisi tanımlı olmayan sağlayıcının butonu yine görünüyor ama
 * tıklanınca yönlendirmek yerine "yakında" diyor: sunucuya gidip Better
 * Auth'un İngilizce hatasıyla dönmekten iyi.
 */
/**
 * Giriş başarısız olursa dönülecek adres: yine giriş ekranı, ama dönüş
 * adresini kaybetmeden.
 */
export function girisHataAdresi(donus: string): string {
  return loginPath(donus)
}

export function SosyalGiris({ acik, donus }: { acik: Provider[]; donus: string }) {
  const [bekleyen, setBekleyen] = useState<Provider | null>(null)
  const [mesaj, setMesaj] = useState<string | null>(null)

  async function giris(s: Provider) {
    setMesaj(null)
    if (!acik.includes(s)) {
      setMesaj(`${ETIKET[s]} ile giriş yakında. Şimdilik e-postanla devam edebilirsin.`)
      return
    }
    setBekleyen(s)
    const { error } = await signIn.social({
      provider: s,
      callbackURL: donus,
      errorCallbackURL: girisHataAdresi(donus),
    })
    // Başarılıysa tarayıcı sağlayıcıya yönleniyor; buraya yalnızca hata düşer.
    if (error) {
      setMesaj(`${ETIKET[s]} ile giriş başlatılamadı. Birazdan tekrar dener misin?`)
      setBekleyen(null)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {(["google", "linkedin", "github"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => void giris(s)}
            disabled={bekleyen !== null}
            aria-label={`${ETIKET[s]} ile devam et`}
            className="flex items-center justify-center gap-2 rounded-2xl border border-cizgi px-3 py-3.5 text-sm font-semibold text-metin transition hover:-translate-y-px hover:border-metin/25 hover:bg-zemin disabled:translate-y-0 disabled:opacity-60 dark:hover:bg-white/5"
          >
            {bekleyen === s ? (
              <span className="size-5 animate-spin rounded-full border-2 border-cizgi border-t-mavi" />
            ) : (
              <SaglayiciIkon s={s} />
            )}
            <span className="hidden sm:inline">{ETIKET[s]}</span>
          </button>
        ))}
      </div>
      {mesaj && (
        <p role="status" className="mt-3 text-sm text-gri">
          {mesaj}
        </p>
      )}
    </div>
  )
}
