"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { LoaderCircle } from "lucide-react"
import { useProfile, useSaveProfile } from "@/features/account/api"
import { GOAL_OPTIONS } from "@/features/onboarding/goals"
import { GOALS, nameSchema, TARGET_ROLE_MAX_LENGTH } from "@/features/onboarding/schema"
import { apiErrorMessage } from "@/lib/api"

const profileFormSchema = z.object({
  name: nameSchema,
  goal: z.enum(GOALS).or(z.literal("")),
  targetRole: z.string().trim().max(TARGET_ROLE_MAX_LENGTH, `Hedef rol en fazla ${TARGET_ROLE_MAX_LENGTH} karakter olabilir.`),
})
type ProfileForm = z.input<typeof profileFormSchema>

const inputClass =
  "w-full rounded-button border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/15"

/** Ad, amaç, hedef rol (DOG-50). Onboarding'de atlananlar burada tamamlanıyor. */
export function ProfileSection() {
  const profile = useProfile(true)
  const save = useSaveProfile()
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const { register, handleSubmit, reset, formState } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: "", goal: "", targetRole: "" },
  })

  useEffect(() => {
    if (profile.data) {
      reset({ name: profile.data.name, goal: profile.data.goal ?? "", targetRole: profile.data.targetRole ?? "" })
    }
  }, [profile.data, reset])

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null)
    try {
      await save.mutateAsync({ name: values.name, goal: values.goal || null, targetRole: values.targetRole })
      setMessage({ kind: "ok", text: "Kaydedildi." })
    } catch (error) {
      setMessage({ kind: "error", text: await apiErrorMessage(error, "Kaydedemedik. Tekrar dener misin?") })
    }
  })

  return (
    <section className="rounded-card border border-border bg-card p-6">
      <h2 className="m-0 text-lg">Profilin</h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4">
        <div>
          <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium">Adın</label>
          <input id="profile-name" {...register("name")} className={inputClass} />
          {formState.errors.name && <p role="alert" className="mt-1 text-sm text-brand-amber">{formState.errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="profile-goal" className="mb-1.5 block text-sm font-medium">Amacın</label>
          <select id="profile-goal" {...register("goal")} className={inputClass}>
            <option value="">Belirtmek istemiyorum</option>
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="profile-role" className="mb-1.5 block text-sm font-medium">Hedef rolün</label>
          <input id="profile-role" placeholder="Örneğin: Frontend geliştirici" {...register("targetRole")} className={inputClass} />
          {formState.errors.targetRole && <p role="alert" className="mt-1 text-sm text-brand-amber">{formState.errors.targetRole.message}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={save.isPending || profile.isPending} className="inline-flex items-center gap-2 rounded-button bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {save.isPending && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />}
            Kaydet
          </button>
          {message && (
            <p role="status" className={message.kind === "ok" ? "text-sm text-brand-green" : "text-sm text-brand-red"}>{message.text}</p>
          )}
        </div>
      </form>
    </section>
  )
}
