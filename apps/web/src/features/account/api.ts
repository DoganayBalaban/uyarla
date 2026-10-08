import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { Goal } from "@/features/onboarding/schema"
import { saveProfile, type ProfilePatchInput } from "@/features/onboarding/api"
import { api } from "@/lib/api"

/** Hesabı ve hesaba bağlı bütün verileri kalıcı olarak siler. */
export async function deleteAccount(): Promise<void> {
  await api.delete("/account")
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
