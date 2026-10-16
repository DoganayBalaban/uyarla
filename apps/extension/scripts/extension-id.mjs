import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * manifest.json'daki açık anahtardan eklenti kimliği (DOG-71).
 *
 * Chrome kimliği anahtarın SHA-256 özetinin ilk 32 onaltılık hanesinden
 * üretiyor (0-f → a-p). Web, kendiliğinden göndermeden önce jetonu bu
 * kimliğe soruyor: `NEXT_PUBLIC_EXTENSION_IDS`.
 *
 *   pnpm --filter @uyarla/extension id
 */
const manifest = JSON.parse(readFileSync(join(import.meta.dirname, "../manifest.json"), "utf8"))
const der = Buffer.from(manifest.key, "base64")
const hex = createHash("sha256").update(der).digest("hex").slice(0, 32)
console.log([...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join(""))
