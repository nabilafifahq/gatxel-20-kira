import 'server-only'
import { z } from 'zod'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'

/*
 * Bentuk respons WebAuthn dari browser sebelum diserahkan ke @simplewebauthn/server.
 * Panjang setiap field dibatasi. Kunci yang tidak dikenal dibuang (z.object tanpa .strict), bukan ditolak:
 * browser dan pustaka klien boleh menambah field baru, dan server hanya membaca field di bawah ini.
 */

const b64url = (max: number) => z.string().min(1).max(max).regex(/^[A-Za-z0-9_-]+={0,2}$/)
const optionalB64url = (max: number) =>
  b64url(max)
    .nullish()
    .transform((v) => v ?? undefined)
const attachment = z
  .enum(['platform', 'cross-platform'])
  .nullish()
  .catch(undefined)
  .transform((v) => v ?? undefined)
// Kira tidak memakai ekstensi WebAuthn; hasilnya selalu dikirim kosong ke pemeriksa.
const extensions = z.unknown().transform(() => ({}))

const credentialBase = {
  id: b64url(1024),
  rawId: b64url(1024),
  type: z.literal('public-key'),
  authenticatorAttachment: attachment,
  clientExtensionResults: extensions,
}

export const authenticationResponseSchema = z.object({
  ...credentialBase,
  response: z.object({
    clientDataJSON: b64url(16_384),
    authenticatorData: b64url(16_384),
    signature: b64url(4096),
    userHandle: optionalB64url(1024),
  }),
})

export const registrationResponseSchema = z.object({
  ...credentialBase,
  response: z.object({
    clientDataJSON: b64url(16_384),
    attestationObject: b64url(65_536),
    authenticatorData: optionalB64url(16_384),
    transports: z.array(z.string().min(1).max(32)).max(8).optional(),
    publicKeyAlgorithm: z.number().int().optional(),
    publicKey: optionalB64url(16_384),
  }),
})

/** Respons masuk dengan passkey yang sudah diperiksa bentuknya, atau null bila tidak sesuai. */
export function readAuthenticationResponse(input: unknown): AuthenticationResponseJSON | null {
  const r = authenticationResponseSchema.safeParse(input)
  return r.success ? (r.data as AuthenticationResponseJSON) : null
}

/** Respons pembuatan passkey yang sudah diperiksa bentuknya, atau null bila tidak sesuai. */
export function readRegistrationResponse(input: unknown): RegistrationResponseJSON | null {
  const r = registrationResponseSchema.safeParse(input)
  return r.success ? (r.data as RegistrationResponseJSON) : null
}
