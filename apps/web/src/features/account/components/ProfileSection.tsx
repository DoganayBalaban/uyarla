"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Check, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProfile, useSaveProfile } from "@/features/account/api"
import { GOAL_OPTIONS } from "@/features/onboarding/goals"
import { GOALS, nameSchema, profilePatchSchema, TARGET_ROLE_MAX_LENGTH } from "@/features/onboarding/schema"
import { apiErrorMessage } from "@/lib/api"

const profileFormSchema = z.object({
  name: nameSchema,
  goal: z.enum(GOALS).or(z.literal("")),
  targetRole: z.string().trim().max(TARGET_ROLE_MAX_LENGTH, `Hedef rol en fazla ${TARGET_ROLE_MAX_LENGTH} karakter olabilir.`),
  // Sunucu şemasıyla aynı kural; boş metin "telefon yok".
  phone: profilePatchSchema.shape.phone.unwrap().unwrap().or(z.literal("")),
})
type ProfileForm = z.input<typeof profileFormSchema>
type ProfileFormOutput = z.output<typeof profileFormSchema>

/** Yerel select; RHF register ile çalışıyor, görünüşü shadcn Input'la aynı. */
const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"

/** Ad, amaç, hedef rol (DOG-50). Onboarding'de atlananlar burada tamamlanıyor. */
export function ProfileSection() {
  const profile = useProfile(true)
  const save = useSaveProfile()
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  // Değerler doğrudan veriden (DOG-153): sekme değişince bileşen yeniden
  // takılıyordu ve efektle yapılan reset boş formda kalıyordu; kaydedilse ad ve
  // hedef rol silinirdi.
  const { register, handleSubmit, formState } = useForm<ProfileForm, unknown, ProfileFormOutput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: "", goal: "", targetRole: "", phone: "" },
    values: profile.data
      ? {
          name: profile.data.name,
          goal: profile.data.goal ?? "",
          targetRole: profile.data.targetRole ?? "",
          phone: profile.data.phone ?? "",
        }
      : undefined,
    resetOptions: { keepDirtyValues: true },
  })

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null)
    try {
      await save.mutateAsync({ name: values.name, goal: values.goal || null, targetRole: values.targetRole, phone: values.phone ?? "" })
      setMessage({ kind: "ok", text: "Kaydedildi." })
    } catch (error) {
      setMessage({ kind: "error", text: await apiErrorMessage(error, "Kaydedemedik. Tekrar dener misin?") })
    }
  })

  // Profil okunamadıysa boş form gösterilmiyor: kaydedilirse kayıtlı amaç ve
  // hedef rol boş değerlerle silinirdi.
  if (profile.isError) {
    return (
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-base">Profilin</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert" className="m-0 text-sm text-destructive">
            Profilini yükleyemedik. Sayfayı yenileyip tekrar dener misin?
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle className="text-base">Profilin</CardTitle>
        <CardDescription>Onboarding'de atladıkların burada; hedef rolün iş aramanda ve önerilerde kullanılır.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Adın</Label>
            <Input id="profile-name" {...register("name")} aria-invalid={formState.errors.name ? true : undefined} />
            {formState.errors.name && <p role="alert" className="m-0 text-sm text-brand-amber">{formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-goal">Amacın</Label>
            <select id="profile-goal" {...register("goal")} className={selectClass}>
              <option value="">Belirtmek istemiyorum</option>
              {GOAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-role">Hedef rolün</Label>
            <Input id="profile-role" placeholder="Örneğin: Frontend geliştirici" {...register("targetRole")} aria-invalid={formState.errors.targetRole ? true : undefined} />
            {formState.errors.targetRole && <p role="alert" className="m-0 text-sm text-brand-amber">{formState.errors.targetRole.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-phone">Telefon</Label>
            <Input id="profile-phone" type="tel" autoComplete="tel" placeholder="+90 555 000 00 00" {...register("phone")} aria-invalid={formState.errors.phone ? true : undefined} />
            {formState.errors.phone && <p role="alert" className="m-0 text-sm text-brand-amber">{formState.errors.phone.message}</p>}
          </div>
          <p className="m-0 text-xs text-muted-foreground sm:col-span-2">
            CV&apos;nde telefon yoksa indirdiğin CV&apos;ye bu yazılır. E-posta olarak hesabındaki adres kullanılır.
          </p>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={save.isPending || profile.isPending}>
              {save.isPending && <LoaderCircle className="motion-safe:animate-spin" aria-hidden />}
              Kaydet
            </Button>
            {message && (
              <p role="status" className={message.kind === "ok" ? "m-0 inline-flex items-center gap-1 text-sm text-brand-green" : "m-0 text-sm text-destructive"}>
                {message.kind === "ok" && <Check className="size-4" aria-hidden />}
                {message.text}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
