/** Tekrar denemek anlamsız: girdi hatalı. Kullanıcıya gösterilir. */
export class PermanentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
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
