'use client'

import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ActionResult, SettingsActions, SettingsDTO } from '@/lib/dto'
import { SettingsScreen } from '@/screens/console/SettingsScreen'
import { passkeyRegisterOptionsAction, passkeyRegisterVerifyAction, registerDeviceAction } from '@/server/actions/auth'

/**
 * Pembungkus client T10: upacara WebAuthn untuk passkey baru berjalan di browser, dan
 * Daftarkan perangkat ini memakai aturan yang sama dengan /perangkat (orang dewasa langsung
 * keluar dari browser ini), lalu browser dibawa ke halaman pilih learner.
 */
export function SettingsClient({ data, actions }: { data: SettingsDTO; actions: Omit<SettingsActions, 'registerThisDevice'> }) {
  const router = useRouter()
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    setSupported(browserSupportsWebAuthn())
  }, [])

  async function registerPasskey(name: string): Promise<ActionResult> {
    const opts = await passkeyRegisterOptionsAction()
    if (!opts.ok) return opts
    let response: Awaited<ReturnType<typeof startRegistration>>
    try {
      response = await startRegistration({ optionsJSON: opts.data.options })
    } catch (e) {
      const name_ = e instanceof Error ? e.name : ''
      if (name_ === 'InvalidStateError') return { ok: false, message: 'Perangkat ini sudah punya passkey untuk akun ini. Pakai passkey yang ada, atau hapus dulu dari daftar.', reference: 'PASSKEY-ADA' }
      if (name_ === 'NotAllowedError' || name_ === 'AbortError')
        return { ok: false, message: 'Pembuatan passkey dibatalkan, jadi tidak ada yang berubah. Coba lagi kapan saja.', reference: 'PASSKEY-BATAL' }
      return { ok: false, message: 'Peramban ini belum bisa membuat passkey. Coba peramban lain, atau tetap masuk dengan password.', reference: 'PASSKEY' }
    }
    const r = await passkeyRegisterVerifyAction({ challengeId: opts.data.challengeId, response, name })
    if (r.ok) router.refresh()
    return r
  }

  async function registerThisDevice(input: { name: string; learnerIds: string[] }): Promise<ActionResult> {
    const r = await registerDeviceAction(input)
    if (!r.ok) return r
    window.location.assign(r.data.redirectTo)
    return { ok: true, data: undefined }
  }

  return <SettingsScreen data={data} actions={{ ...actions, registerThisDevice }} registerPasskey={supported ? registerPasskey : undefined} />
}
