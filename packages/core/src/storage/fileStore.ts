import { mkdir, writeFile, readFile } from "node:fs/promises"
import { resolve, dirname, extname, basename } from "node:path"
import { randomUUID } from "node:crypto"

/**
 * Dosya depolama sözleşmesi. Sprint 3'te S3 uyumlu bir uygulama yazılır,
 * çağıran kod değişmez (spec §5).
 */
export interface FileStore {
  save(buffer: Buffer, filename: string): Promise<string>
  read(path: string): Promise<Buffer>
}

export class LocalFileStore implements FileStore {
  constructor(private readonly baseDir: string) {}

  async save(buffer: Buffer, filename: string): Promise<string> {
    // Ad rastgele üretilir, kullanıcının verdiği ad yola girmez: hem yol
    // geçişini engeller hem de diskte kişi adı tutmaktan kaçınır
    // ("elif-yilmaz-cv.pdf" tek başına kişisel veridir).
    const ext = extname(basename(filename))

    // Mutlak yol döndürülüyor: dosyayı yazan süreç (web) ile okuyan süreç
    // (worker) farklı çalışma dizinlerinde. Göreli yol kaydedilirse worker
    // dosyayı bulamaz.
    const path = resolve(this.baseDir, `${randomUUID()}${ext}`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, buffer)
    return path
  }

  async read(path: string): Promise<Buffer> {
    return readFile(path)
  }
}
