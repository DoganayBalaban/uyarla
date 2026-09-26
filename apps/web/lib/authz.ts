import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "./auth"

export interface Oturum {
  user: { id: string; isAnonymous: boolean }
}

/** HTTP durumunu ve makine okunur kodu taşıyan yetki hatası. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message)
    this.name = "AuthError"
  }
}

/** Oturum şart; anonim yeterli. */
export function ensureSession(session: Oturum | null): Oturum {
  // Mesajlar spec §10'daki tablodan; marka rehberi §6 tonunda.
  if (!session) {
    throw new AuthError("Devam etmek için giriş yapman gerekiyor.", 401, "oturum_yok")
  }
  return session
}

/** Kayıtlı oturum şart; anonim yetmez. */
export function ensureRegistered(session: Oturum | null): Oturum {
  const oturum = ensureSession(session)
  if (oturum.user.isAnonymous) {
    throw new AuthError(
      "CV'ni uyarlamak için e-postanı bırakman yeterli.",
      401,
      "kayit_gerekli",
    )
  }
  return oturum
}

/**
 * Kaynağın sahibi oturum sahibi mi.
 *
 * Uymuyorsa 404 dönüyor, 403 değil: 403 kaynağın var olduğunu sızdırır
 * (spec §8). Sahipsiz kaynak da 404 — sahipsiz satır bir hata durumu ve
 * kimseye açılmamalı.
 *
 * Oturum kontrolü sahiplik karşılaştırmasından ÖNCE yapılıyor. Aksi hâlde
 * `null === null` gibi bir kaza sahipsiz kaynağı herkese açardı.
 */
export function ensureOwner(ownerId: string | null, session: Oturum | null): Oturum {
  const oturum = ensureSession(session)
  if (!ownerId || ownerId !== oturum.user.id) {
    throw new AuthError("Bulunamadı.", 404, "bulunamadi")
  }
  return oturum
}

/** İstek başlıklarından oturumu okur. */
export async function getSession(): Promise<Oturum | null> {
  const sonuc = await auth.api.getSession({ headers: await headers() })
  if (!sonuc?.user) return null
  return {
    user: {
      id: sonuc.user.id,
      // anonymous eklentisi bu alanı ekliyor ve şemada nullable; yoksa
      // kayıtlı sayılıyor.
      isAnonymous: (sonuc.user as { isAnonymous?: boolean | null }).isAnonymous ?? false,
    },
  }
}

/**
 * AuthError'ı HTTP yanıtına çevirir; başka hata türlerinde null döner.
 *
 * Route'ların catch bloğunda tek satırla kullanılıyor, böylece her uçta aynı
 * durum kodu ve aynı dil çıkıyor.
 */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof AuthError)) return null
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
}
