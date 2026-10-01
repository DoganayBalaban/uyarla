import { useMutation } from "@tanstack/react-query"
import { api } from "@/lib/api"

/** Hesabı ve hesaba bağlı bütün verileri kalıcı olarak siler. */
export async function deleteAccount(): Promise<void> {
  await api.delete("/account")
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: deleteAccount })
}
