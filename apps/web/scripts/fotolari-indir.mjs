/**
 * Tanıtım sayfası fotoğraflarını public/foto/ altına indirir.
 *
 * Kareler Higgsfield Soul 2.0 ile üretildi (28–29 Eylül 2026); persona-1 ve
 * son-cagri'nin ilk hâllerinde yapay yazı vardı (kıyafette, gazetede), 30
 * Eylül'de Seedream 5.0 Lite ile yenilendi: persona-1 Soul karesinden yazısı
 * silinerek düzenlendi, son-cagri baştan üretildi. Bulut
 * geliştirme ortamının ağ politikası görsel sunucusuna izin vermediği için
 * indirme ayrı bir adım: yerelde `node apps/web/scripts/fotolari-indir.mjs`
 * çalıştır, sonra web'i yeniden derle. Dosya varsa atlanır.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const KOK = "https://d8j0ntlcm91z4.cloudfront.net/user_3FBh9Lhx3EwnaT140CNrvwnIK97"
const FOTOLAR = {
  "cikti.png": "hf_20260928_205241_ee13b9c7-e506-49e1-b630-a138d16f939b.png",
  "persona-1.png": "hf_20260930_112414_b1567f8d-75bc-4771-b75f-daefddfea2c0.png",
  "persona-2.png": "hf_20260928_205304_65d3c9f1-e6b1-4791-9d39-70fd26d6a467.png",
  "persona-3.png": "hf_20260929_150402_be252497-2253-444d-b9da-b34e888168ac.png",
  "persona-4.png": "hf_20260928_205219_7a5acc3f-3a0c-4521-8e16-dee4f6221672.png",
  "son-cagri.png": "hf_20260930_112318_6c227559-0dfa-42fe-a520-834203e7e8cd.png",
}

const hedef = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "foto")
mkdirSync(hedef, { recursive: true })

for (const [ad, uzak] of Object.entries(FOTOLAR)) {
  const yol = join(hedef, ad)
  if (existsSync(yol)) {
    console.log(`atlandı  ${ad} (zaten var)`)
    continue
  }
  const yanit = await fetch(`${KOK}/${uzak}`)
  if (!yanit.ok) throw new Error(`${ad}: HTTP ${yanit.status}`)
  writeFileSync(yol, Buffer.from(await yanit.arrayBuffer()))
  console.log(`indirildi ${ad}`)
}
