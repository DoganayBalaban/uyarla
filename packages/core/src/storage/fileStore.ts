import { mkdir, writeFile, readFile, unlink } from "node:fs/promises"
import { resolve, dirname, extname, basename, relative, sep } from "node:path"
import { randomUUID } from "node:crypto"
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

/**
 * Dosya depolama sözleşmesi (spec §5). `save` bir başvuru döndürüyor; bu
 * `Resume.filePath`'e yazılıyor ve aynı depoya `read`/`delete` ile geri
 * veriliyor. Çağıran kod deponun disk mi S3 mü olduğunu bilmiyor.
 */
export interface FileStore {
  save(buffer: Buffer, filename: string): Promise<string>
  read(ref: string): Promise<Buffer>
  /**
   * Dosyayı siler. Zaten yoksa da true: istenen sonuç sağlanmış. Başvuru bu
   * depoya ait değilse dokunmadan false döner; başvuru veritabanından
   * geliyor ve bozuk bir satır rastgele bir dosyayı sildirmemeli.
   */
  delete(ref: string): Promise<boolean>
}

/**
 * Rastgele dosya adı: hem yol geçişini engeller hem de depoda kişi adı
 * tutmaktan kaçınır ("elif-yilmaz-cv.pdf" tek başına kişisel veridir).
 * Uzantı korunuyor: metin çıkarma türü ondan anlıyor.
 */
function randomName(filename: string): string {
  return `${randomUUID()}${extname(basename(filename))}`
}

/**
 * Yol, depo dizininin ALTINDA mı.
 *
 * Düz `startsWith` yetmiyor: "/veri/storage-yedek" dizesi "/veri/storage" ile
 * başlıyor ama onun altında değil. `relative` ile bakmak bu tuzağı ve
 * ".." geçişlerini birlikte kapatıyor.
 */
export function isInsideStorage(path: string, storageDir: string): boolean {
  const storage = resolve(storageDir)
  const target = resolve(path)
  const diff = relative(storage, target)
  return diff !== "" && !diff.startsWith("..") && !diff.startsWith(sep)
}

/** Yerel disk; geliştirmede ve web ile worker aynı makinedeyken. */
export class LocalFileStore implements FileStore {
  constructor(private readonly baseDir: string) {}

  async save(buffer: Buffer, filename: string): Promise<string> {
    // Mutlak yol döndürülüyor: dosyayı yazan süreç (web) ile okuyan süreç
    // (worker) farklı çalışma dizinlerinde. Göreli yol kaydedilirse worker
    // dosyayı bulamaz.
    const path = resolve(this.baseDir, randomName(filename))
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, buffer)
    return path
  }

  async read(path: string): Promise<Buffer> {
    return readFile(path)
  }

  async delete(path: string): Promise<boolean> {
    if (!isInsideStorage(path, this.baseDir)) return false
    try {
      await unlink(path)
    } catch (error) {
      // ENOENT: dosya zaten yok, istenen sonuç sağlanmış sayılıyor.
      if ((error as { code?: string }).code !== "ENOENT") throw error
    }
    return true
  }
}

/** S3FileStore'un kullandığı istemci yüzeyi; testte sahtesi veriliyor. */
export interface S3Like {
  send(command: PutObjectCommand | GetObjectCommand | DeleteObjectCommand): Promise<unknown>
}

const PREFIX = "resumes/"
/** Yalnızca `save`'in ürettiği biçimdeki anahtarlar: önek + uuid + uzantı. */
const OWN_KEY = /^resumes\/[0-9a-f-]{36}(\.[A-Za-z0-9]{1,8})?$/

/**
 * S3 uyumlu depo (üretimde Cloudflare R2). Web Vercel'de, worker ayrı
 * sunucuda; ikisi de dosyaya buradan ulaşıyor (K-02).
 *
 * Başvuru biçimi `s3://<bucket>/resumes/<uuid>.<uzantı>`: yerel yollardan
 * ayırt ediliyor ve uzantıyı taşıyor.
 */
export class S3FileStore implements FileStore {
  constructor(
    private readonly client: S3Like,
    private readonly bucket: string,
  ) {}

  /** Başvuru bu bucket'ta, bu deponun ürettiği bir anahtarsa anahtarı döner. */
  private keyOf(ref: string): string | null {
    const head = `s3://${this.bucket}/`
    if (!ref.startsWith(head)) return null
    const key = ref.slice(head.length)
    return OWN_KEY.test(key) ? key : null
  }

  async save(buffer: Buffer, filename: string): Promise<string> {
    const key = `${PREFIX}${randomName(filename)}`
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer }))
    return `s3://${this.bucket}/${key}`
  }

  async read(ref: string): Promise<Buffer> {
    const key = this.keyOf(ref)
    if (!key) throw new Error(`Bu depoya ait olmayan dosya: ${ref}`)
    const reply = (await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }))) as {
      Body?: { transformToByteArray(): Promise<Uint8Array> }
    }
    if (!reply.Body) throw new Error(`Dosya boş geldi: ${ref}`)
    return Buffer.from(await reply.Body.transformToByteArray())
  }

  async delete(ref: string): Promise<boolean> {
    const key = this.keyOf(ref)
    if (!key) return false
    // S3'te olmayan anahtarı silmek hata vermiyor; ENOENT karşılığı gerekmiyor.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    return true
  }
}

type StorageEnv = Record<string, string | undefined>

/**
 * Ortam değişkenlerine göre depo: `S3_BUCKET` varsa S3, yoksa yerel disk.
 * S3 yarım ayarlıysa hata: sessizce yerel diske düşmek, web ile worker ayrı
 * makinelerdeyken dosyaları kaybettirir.
 */
export function fileStoreFromEnv(env: StorageEnv = process.env): FileStore {
  if (!env.S3_BUCKET) return new LocalFileStore(env.STORAGE_DIR ?? "./storage")

  const missing = (["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const).filter((k) => !env[k])
  if (missing.length) throw new Error(`S3_BUCKET tanımlı ama eksik: ${missing.join(", ")}`)

  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    // R2 bölge kullanmıyor; SDK yine de bir değer istiyor.
    region: env.S3_REGION ?? "auto",
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
  })
  return new S3FileStore(client, env.S3_BUCKET)
}
