import axios from "axios"

/**
 * Tarayıcıdan kendi API'mize giden isteklerin tek istemcisi. Yanıt 2xx
 * değilse axios hata fırlatıyor; API'nin `{ error }` gövdesindeki Türkçe
 * mesajı apiErrorMessage çıkarıyor.
 */
export const api = axios.create({ baseURL: "/api" })

/** Başarısız isteğin HTTP durum kodu; yanıt hiç gelmediyse (ağ kesintisi) null. */
export function apiStatus(error: unknown): number | null {
  return axios.isAxiosError(error) ? (error.response?.status ?? null) : null
}

/** API'nin gönderdiği hata gövdesi (`{ error, code }`); yoksa boş nesne. */
export async function apiErrorBody(error: unknown): Promise<{ error?: string; code?: string }> {
  if (!axios.isAxiosError(error)) return {}
  let data: unknown = error.response?.data
  // Blob bekleyen isteklerde (dosya indirme) hata gövdesi de blob geliyor.
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      data = JSON.parse(await data.text())
    } catch {
      return {}
    }
  }
  return data && typeof data === "object" ? (data as { error?: string; code?: string }) : {}
}

/** Kullanıcıya gösterilecek hata mesajı: API'ninki, yoksa verilen yedek. */
export async function apiErrorMessage(error: unknown, fallback: string): Promise<string> {
  const { error: message } = await apiErrorBody(error)
  return typeof message === "string" && message ? message : fallback
}
