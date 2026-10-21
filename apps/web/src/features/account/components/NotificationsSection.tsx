"use client"

import { useProfile, useSaveProfile } from "@/features/account/api"
import { CONSENT_TEXT } from "@/features/account/consent"
import type { ProfilePatchInput } from "@/features/onboarding/api"

/**
 * E-posta tercihleri (DOG-98, DOG-126). Kapatılabilen üç kategori; giriş
 * bağlantısı, ödeme onayı ve hesap silme gibi işlem e-postaları her zaman
 * gidiyor. Ürün haberleri açık onaya dayalı ve varsayılan kapalı (DOG-130).
 */
export function NotificationsSection() {
  const profile = useProfile(true)
  const save = useSaveProfile()
  const busy = profile.isPending || save.isPending
  const data = profile.data

  const rows: Array<{ key: "applicationReminders" | "accessUpdates" | "productNews"; checked: boolean; title: string; text: string }> = [
    {
      key: "applicationReminders",
      checked: data?.applicationReminders ?? true,
      title: "Başvuru hatırlatmaları",
      text: "Mülakatından bir gün önce, uyarladığın bir ilanın son başvuru günü yaklaşınca ve \"Başvuruldu\"ya aldığın bir başvurudan bir hafta ses çıkmazsa. Her biri bir kez.",
    },
    {
      key: "accessUpdates",
      checked: data?.accessUpdates ?? true,
      title: "Erişim dönemi bilgileri",
      text: "Paket aldıysan, dönemin bitmesine iki gün kala bir kez. Dönem otomatik yenilenmiyor.",
    },
    {
      key: "productNews",
      checked: data?.productNews ?? false,
      title: "Ürün haberleri ve öneriler",
      text: CONSENT_TEXT,
    },
  ]

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <h2 className="m-0 text-lg">E-posta tercihleri</h2>
      <p className="m-0 mt-1 text-sm text-muted-foreground">
        Giriş bağlantısı, ödeme onayı ve hesap silme gibi hesabınla ilgili e-postalar her zaman gider. Hiçbir e-postayı
        günde birden fazla göndermiyoruz.
      </p>
      {rows.map((row) => (
        <label key={row.key} className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={row.checked}
            disabled={busy}
            onChange={(e) => save.mutate({ [row.key]: e.target.checked } as ProfilePatchInput)}
            className="mt-1 size-4 accent-brand-blue"
          />
          <span>
            <span className="block text-sm font-medium">{row.title}</span>
            <span className="block text-sm text-muted-foreground">{row.text}</span>
          </span>
        </label>
      ))}
      {save.isError && (
        <p role="alert" className="mt-3 text-sm text-brand-red">
          Kaydedemedik. Birazdan tekrar dener misin?
        </p>
      )}
    </section>
  )
}
