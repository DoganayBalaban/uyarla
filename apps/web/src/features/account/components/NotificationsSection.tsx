"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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

  // "Erişim dönemi bilgileri" kalktı (DOG-158): deneme hatırlatmasını ve makbuzları Polar gönderiyor.
  const rows: Array<{ key: "applicationReminders" | "accessUpdates" | "productNews"; checked: boolean; title: string; text: string }> = [
    {
      key: "applicationReminders",
      checked: data?.applicationReminders ?? true,
      title: "Başvuru hatırlatmaları",
      text: "Mülakatından bir gün önce, uyarladığın bir ilanın son başvuru günü yaklaşınca ve \"Başvuruldu\"ya aldığın bir başvurudan bir hafta ses çıkmazsa. Her biri bir kez.",
    },
    {
      key: "productNews",
      checked: data?.productNews ?? false,
      title: "Ürün haberleri ve öneriler",
      text: CONSENT_TEXT,
    },
  ]

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle className="text-base">E-posta tercihleri</CardTitle>
        <CardDescription>
          Giriş bağlantısı, ödeme onayı ve hesap silme gibi hesabınla ilgili e-postalar her zaman gider. Hiçbir e-postayı
          günde birden fazla göndermiyoruz.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="m-0 list-none divide-y p-0">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <Label htmlFor={`bildirim-${row.key}`} className="block cursor-pointer font-normal">
                <span className="block text-sm font-medium">{row.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{row.text}</span>
              </Label>
              <Switch
                id={`bildirim-${row.key}`}
                checked={row.checked}
                disabled={busy}
                onCheckedChange={(checked) => save.mutate({ [row.key]: checked } as ProfilePatchInput)}
                className="mt-0.5"
              />
            </li>
          ))}
        </ul>
        {save.isError && (
          <p role="alert" className="m-0 mt-3 text-sm text-destructive">
            Kaydedemedik. Birazdan tekrar dener misin?
          </p>
        )}
      </CardContent>
    </Card>
  )
}
