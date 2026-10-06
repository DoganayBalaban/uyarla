/**
 * Tekrar denemek anlamsız: girdi hatalı. Mesajı kullanıcıya gösterilir;
 * teknik ayrıntı varsa `cause`'da taşınır ve yalnızca günlüğe yazılır.
 */
export class PermanentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = "PermanentError"
  }
}

/** Geçici: servis erişilemez, zaman aşımı. Tekrar denenir. */
export class TransientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = "TransientError"
  }
}
