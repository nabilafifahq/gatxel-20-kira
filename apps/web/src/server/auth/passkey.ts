import 'server-only'
import { and, eq, gt } from 'drizzle-orm'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import type { AuthenticationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { tables } from '@kira/db'
import { authDb } from '../db'
import { env, origin, rpId } from '../env'
import { invalid } from '../errors'

const { passkey, webauthnChallenge, userAccount } = tables
const CHALLENGE_TTL_MS = 5 * 60 * 1000

function uuidBytes(uuid: string): Uint8Array<ArrayBuffer> {
  const hex = uuid.replace(/-/g, '')
  const out = new Uint8Array(new ArrayBuffer(16))
  for (let i = 0; i < 16; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function storeChallenge(challenge: string, purpose: 'register' | 'login', userId: string | null): Promise<string> {
  const [row] = await authDb()
    .insert(webauthnChallenge)
    .values({ challenge, purpose, userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) })
    .returning({ id: webauthnChallenge.id })
  return row!.id
}

async function takeChallenge(id: string, purpose: 'register' | 'login', userId: string | null): Promise<string> {
  const rows = await authDb()
    .delete(webauthnChallenge)
    .where(and(eq(webauthnChallenge.id, id), eq(webauthnChallenge.purpose, purpose), gt(webauthnChallenge.expiresAt, new Date())))
    .returning({ challenge: webauthnChallenge.challenge, userId: webauthnChallenge.userId })
  const row = rows[0]
  if (!row || (userId !== null && row.userId !== userId)) throw invalid('Permintaan passkey kedaluwarsa. Coba lagi.')
  return row.challenge
}

export async function registrationOptions(user: { id: string; email: string; name: string }): Promise<{ challengeId: string; options: PublicKeyCredentialCreationOptionsJSON }> {
  const existing = await authDb().select({ id: passkey.id, transports: passkey.transports }).from(passkey).where(eq(passkey.userId, user.id))
  const options = await generateRegistrationOptions({
    rpName: env().KIRA_RP_NAME,
    rpID: rpId(),
    userName: user.email,
    userDisplayName: user.name,
    userID: uuidBytes(user.id),
    attestationType: 'none',
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  })
  const challengeId = await storeChallenge(options.challenge, 'register', user.id)
  return { challengeId, options }
}

export async function verifyRegistration(user: { id: string }, challengeId: string, response: RegistrationResponseJSON, name: string): Promise<void> {
  const expectedChallenge = await takeChallenge(challengeId, 'register', user.id)
  const result = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: origin(), expectedRPID: rpId(), requireUserVerification: false })
  if (!result.verified) throw invalid('Passkey tidak bisa diverifikasi. Coba lagi.')
  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo
  await authDb()
    .insert(passkey)
    .values({
      id: credential.id,
      userId: user.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: name.slice(0, 60) || 'Passkey',
    })
}

export async function authenticationOptions(): Promise<{ challengeId: string; options: PublicKeyCredentialRequestOptionsJSON }> {
  const options = await generateAuthenticationOptions({ rpID: rpId(), userVerification: 'preferred' })
  const challengeId = await storeChallenge(options.challenge, 'login', null)
  return { challengeId, options }
}

/** Verifikasi login passkey. Mengembalikan pengguna dewasa pemilik passkey. */
export async function verifyAuthentication(challengeId: string, response: AuthenticationResponseJSON): Promise<{ id: string; orgId: string }> {
  const expectedChallenge = await takeChallenge(challengeId, 'login', null)
  const rows = await authDb()
    .select({ id: passkey.id, publicKey: passkey.publicKey, counter: passkey.counter, transports: passkey.transports, userId: passkey.userId, orgId: userAccount.orgId, kind: userAccount.kind, disabledAt: userAccount.disabledAt })
    .from(passkey)
    .innerJoin(userAccount, eq(passkey.userId, userAccount.id))
    .where(eq(passkey.id, response.id))
    .limit(1)
  const cred = rows[0]
  if (!cred || cred.kind !== 'adult' || cred.disabledAt) throw invalid('Passkey ini belum terdaftar di Kira. Masuk dengan password lalu daftarkan passkey di Pengaturan.')
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: rpId(),
    credential: { id: cred.id, publicKey: Uint8Array.from(cred.publicKey), counter: cred.counter, transports: cred.transports },
    requireUserVerification: false,
  })
  if (!result.verified) throw invalid('Passkey tidak bisa diverifikasi. Coba lagi.')
  await authDb()
    .update(passkey)
    .set({ counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() })
    .where(eq(passkey.id, cred.id))
  return { id: cred.userId, orgId: cred.orgId }
}

export async function listPasskeys(userId: string) {
  return authDb()
    .select({ id: passkey.id, name: passkey.name, createdAt: passkey.createdAt, lastUsedAt: passkey.lastUsedAt })
    .from(passkey)
    .where(eq(passkey.userId, userId))
}

export async function removePasskey(userId: string, passkeyId: string): Promise<void> {
  await authDb().delete(passkey).where(and(eq(passkey.userId, userId), eq(passkey.id, passkeyId)))
}
