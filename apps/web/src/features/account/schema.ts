import { z } from "zod"

/**
 * `DELETE /api/account` gövdesi. İsteğe bağlı: arayüz hiç göndermiyor;
 * gelirse kimlik oturumla eşleşmek zorunda (route'a bakın).
 */
export const deleteAccountBodySchema = z.object({ userId: z.string().optional() })
