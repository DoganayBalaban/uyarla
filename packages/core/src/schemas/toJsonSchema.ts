import { z } from "zod"

/**
 * Zod şemasını LM Studio'nun `strict: true` kısıtına uygun JSON Schema'ya
 * çevirir (K-04).
 *
 * Zod 4'ün yerleşik dönüştürücüsü zaten `additionalProperties: false` üretiyor
 * ve nullable alanları `required` listesinde tutuyor — strict kısıtının
 * istediği tam olarak budur. Tek müdahale `$schema` anahtarını atmak:
 * OpenAI uyumlu uçlar bunu şema gövdesinde beklemiyor.
 *
 * Not: Bu yüzden opsiyonel alanlarda `.optional()` DEĞİL `.nullable()`
 * kullanılır. `.optional()` alanı `required` listesinden düşürür ve kısıt
 * reddedilir; model bilgi yokken alanı atlamak yerine `null` yazmalı.
 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _atilan, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>
  return rest
}
