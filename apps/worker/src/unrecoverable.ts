import { UnrecoverableError } from "bullmq"
import type { PermanentError } from "@uyarla/core"

/**
 * Kalıcı hatayı BullMQ'nun tekrar denemeyeceği hataya çevirir. Mesaj
 * kullanıcıya gidiyor; teknik neden (`cause`) varsa burada günlüğe yazılıyor,
 * yoksa ekrandaki genel metnin arkasında kaybolur.
 */
export function toUnrecoverable(error: PermanentError, queue: string): UnrecoverableError {
  if (error.cause) {
    const detail = error.cause instanceof Error ? error.cause.message : String(error.cause)
    console.error(`[${queue}] ${error.code}: ${detail}`)
  }
  return new UnrecoverableError(error.message)
}
