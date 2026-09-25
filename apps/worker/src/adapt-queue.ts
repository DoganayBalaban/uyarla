export const ADAPT_QUEUE = "adapt"

export interface AdaptJobData {
  /**
   * Uyarlama kaydı web katmanında oluşturuluyor ve kimliği buraya geliyor.
   *
   * Sprint 1'de arayüz BullMQ iş kimliğini yokluyordu; burada olmaz: kararlar
   * ve indirme de aynı kaydı adreslemek zorunda ve iş kimliği kuyruk
   * temizlendiğinde kayboluyor.
   */
  adaptationId: string
}

/** Geçici hatalarda üstel geri çekilmeyle 3 deneme (spec §13). */
export const ADAPT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
}
