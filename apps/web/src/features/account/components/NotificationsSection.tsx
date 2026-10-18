"use client"

import { useProfile, useSaveProfile } from "@/features/account/api"

/**
 * E-posta bildirimleri (DOG-98). Şimdilik tek ayar: "Başvuruldu"dan bir hafta
 * sonra aşaması değişmeyen başvurular için takip hatırlatması.
 */
export function NotificationsSection() {
  const profile = useProfile(true)
  const save = useSaveProfile()
  const enabled = profile.data?.applicationReminders ?? true

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <h2 className="m-0 text-lg">Bildirimler</h2>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          disabled={profile.isPending || save.isPending}
          onChange={(e) => save.mutate({ applicationReminders: e.target.checked })}
          className="mt-1 size-4 accent-brand-blue"
        />
        <span>
          <span className="block text-sm font-medium">Başvuru takip hatırlatması</span>
          <span className="block text-sm text-muted">
            Bir başvuruyu &quot;Başvuruldu&quot;ya aldıktan bir hafta sonra aşaması değişmediyse bir kez e-posta
            gönderiyoruz.
          </span>
        </span>
      </label>
      {save.isError && (
        <p role="alert" className="mt-3 text-sm text-brand-red">
          Kaydedemedik. Birazdan tekrar dener misin?
        </p>
      )}
    </section>
  )
}
