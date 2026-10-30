import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Goal } from "@/features/onboarding/schema"
import { saveProfile, type ProfilePatchInput } from "@/features/onboarding/api"
import { billingStatusKey } from "@/features/billing/api"
import { api } from "@/lib/api"

/** Hesabı ve hesaba bağlı bütün verileri kalıcı olarak siler. */
export async function deleteAccount(): Promise<void> {
  await api.delete("/account")
}

/**
 * Silinen hesabın istemcideki verisini bırakır. `clear()` önbelleği boşaltıyor
 * ama açık ekrana haber vermiyor: her sayfadaki deneme bandı "599 ₺
 * çekilecek" demeye devam ediyordu. Kabuğun gösterdiği abonelik durumu önce
 * boşaltılıyor ki açık gözlemciler de görsün.
 */
export function forgetAccountData(queryClient: QueryClient): void {
  queryClient.setQueryData(billingStatusKey, null)
  queryClient.clear()
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: deleteAccount })
}

export interface ProfileView {
  name: string
  email: string
  goal: Goal | null
  targetRole: string | null
  phone: string | null
  /** Başvuru hatırlatmaları e-postası (DOG-98, DOG-128). */
  applicationReminders: boolean
  /** Erişim dönemi bilgileri (DOG-129); eski yanıtlarda yok. */
  accessUpdates?: boolean
  /** Ürün haberleri, açık onayla (DOG-130); eski yanıtlarda yok. */
  productNews?: boolean
}

export const profileQueryKey = ["profile"] as const

export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: async () => (await api.get<{ profile: ProfileView }>("/profile")).data.profile,
    enabled,
  })
}

export function useSaveProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: ProfilePatchInput) => saveProfile(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileQueryKey }),
  })
}

/** "Tüm ilanlarda hariç tut" listesindeki bir kavram (DOG-90). */
export interface ExcludedConceptView {
  key: string
  term: string
  createdAt: string
}

export const excludedConceptsQueryKey = ["excluded-concepts"] as const

export function useExcludedConcepts() {
  return useQuery({
    queryKey: excludedConceptsQueryKey,
    queryFn: async () => (await api.get<{ concepts: ExcludedConceptView[] }>("/excluded-concepts")).data.concepts,
  })
}

export function useRemoveExcludedConcept() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (key: string) => {
      await api.delete("/excluded-concepts", { data: { key } })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: excludedConceptsQueryKey }),
  })
}

/** Anlattığın ve kabul ettiğin bir deneyim (DOG-116); core RememberedFact. */
export interface RememberedFactView {
  id: string
  company: string
  title: string
  text: string
  answer: string
  requirement: string | null
  createdAt: string
}

export const factsQueryKey = ["facts"] as const

export function useFacts() {
  return useQuery({
    queryKey: factsQueryKey,
    queryFn: async () => (await api.get<{ facts: RememberedFactView[] }>("/profile", { params: { facts: 1 } })).data.facts,
  })
}

export function useForgetFact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (factId: string) => {
      await api.delete("/profile", { data: { factId } })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: factsQueryKey }),
  })
}
