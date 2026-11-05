'use server'

import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { TERMS_MESSAGE } from '@/lib/required-rules'
import { audit } from '../audit'
import { ipHash } from '../auth/crypto'
import { clearPendingGoogle, googleConfig, readPendingGoogle } from '../auth/google'
import { clientIp, throttleIp } from '../auth/ratelimit'
import { startSession } from '../auth/session'
import { verifyTurnstile } from '../auth/turnstile'
import { invalid, notFound, runAction } from '../errors'
import { completeGoogleSignup, GOOGLE_FAILED, googleConsentPath } from '../signup/google'

const schema = z.object({ consent: z.boolean(), marketing: z.boolean().optional(), turnstile: z.string().max(2048).optional() }).strict()

/**
 * Langkah persetujuan orang tua baru lewat Google. Autentikasinya cookie bertanda tangan dari callback, yang membuktikan
 * Google sudah memeriksa email ini di browser yang sama. Akun baru dibuat di sini, bukan sebelum ada persetujuan.
 */
export async function googleConsentAction(input: { consent: boolean; marketing?: boolean; turnstile?: string }): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction('googleConsent', async () => {
    if (!googleConfig()) throw notFound()
    const data = schema.parse(input)
    await throttleIp('google-signup', 6)
    if (data.consent !== true) throw invalid(TERMS_MESSAGE, { consent: TERMS_MESSAGE })
    const ip = await clientIp()
    await verifyTurnstile(data.turnstile, ip)
    const claims = await readPendingGoogle()
    if (!claims) return { redirectTo: GOOGLE_FAILED }
    const r = await completeGoogleSignup({ claims, marketing: data.marketing === true, ipHash: ipHash(ip) })
    await clearPendingGoogle()
    if (r.status === 'ok') {
      await startSession({ id: r.userId, orgId: r.orgId, kind: 'adult' })
      await audit({ orgId: r.orgId, userId: r.userId, role: 'guardian' }, 'login.signup', r.userId, { via: 'google' })
    }
    return { redirectTo: googleConsentPath(r.status) }
  })
}
