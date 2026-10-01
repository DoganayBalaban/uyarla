import { QueryClient } from "@tanstack/react-query"
import { apiStatus } from "@/lib/api"

/**
 * Yalnızca yanıt gelmeyen istek (ağ kesintisi) yeniden deneniyor. API'nin
 * verdiği 4xx/5xx kalıcı: tekrar sormak hatayı göstermeyi geciktirir.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return apiStatus(error) === null && failureCount < 2
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        // Yoklamalar kendi aralığını belirliyor; sekmeye dönünce ayrıca sorulmasın.
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
}
