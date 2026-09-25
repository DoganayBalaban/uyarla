import { mkdir, writeFile, readFile } from "node:fs/promises"
import { join, dirname, extname, resolve } from "node:path"
import { randomUUID } from "node:crypto"

/**
 * Dosya depolama sözleşmesi. Sprint 3'te S3 uygulaması yazılır,
 * çağıran kod değişmez (spec §5).
 */
export interface FileStore {
  save(buffer: Buffer, filename: string): Promise<string>
  read(path: string): Promise<Buffer>
}

export class LocalFileStore implements FileStore {
  constructor(private readonly baseDir: string) {}

  /**
   * Mutlak yol döndürür. Web ve worker farklı çalışma dizinlerinden
   * çalışıyor; göreli yol birinin yazdığını ötekinin bulamamasına yol açar.
   */
  async save(buffer: Buffer, filename: string): Promise<string> {
    const path = resolve(join(this.baseDir, `${randomUUID()}${extname(filename)}`))
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, buffer)
    return path
  }

  async read(path: string): Promise<Buffer> {
    return readFile(path)
  }
}
