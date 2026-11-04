'use client'

import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { useEffect, useState } from 'react'
import { LoginScreen, type LoginPanelExtras } from '@/screens/public/LoginScreen'
import type { ActionResult, LoginScreenProps } from '@/lib/dto'
import { resendVerificationAction } from '@/server/actions/signup'
import { passkeyOptionsAction, passkeyVerifyAction, passwordLoginAction, requestResetAction } from '@/server/actions/auth'

/** Upacara WebAuthn dijalankan di browser; server hanya membuat dan memeriksa tantangan. */
export function LoginClient({ next, notice, turnstileSiteKey, ...panel }: { next: string | null; notice: LoginScreenProps['notice']; turnstileSiteKey?: string | null } & LoginPanelExtras) {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(browserSupportsWebAuthn())
  }, [])

  async function passkeyLogin(n: string | null): Promise<ActionResult<{ redirectTo: string }>> {
    const opts = await passkeyOptionsAction()
    if (!opts.ok) return opts
    try {
      const response = await startAuthentication({ optionsJSON: opts.data.options })
      return await passkeyVerifyAction({ challengeId: opts.data.challengeId, response, next: n })
    } catch {
      return { ok: false, message: 'Masuk dengan passkey dibatalkan atau tidak tersedia di perangkat ini.', reference: 'PASSKEY' }
    }
  }

  return (
    <LoginScreen
      {...panel}
      next={next}
      notice={notice}
      passwordLogin={passwordLoginAction}
      passkeyLogin={passkeyLogin}
      passkeySupported={supported}
      requestReset={requestResetAction}
      turnstileSiteKey={turnstileSiteKey ?? null}
      resendVerification={resendVerificationAction}
    />
  )
}
