import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import {
  changePasswordAction,
  inviteMemberAction,
  removePasskeyAction,
  renameDeviceAction,
  revokeDeviceAction,
  revokeInviteAction,
  updateLearnerLimitsAction,
} from '@/server/actions/console-settings'
import { getActor, pageActor } from '@/server/auth/actor'
import { getDevice } from '@/server/auth/device'
import { settingsDTO } from '@/server/dal/console-settings'
import { load } from '@/server/page'
import { spUuid, type SearchParams } from '@/server/params'
import { SettingsClient } from './SettingsClient'

export const metadata: Metadata = { title: 'Pengaturan' }

/** T10 Pengaturan: akun, passkey, perangkat, batas waktu layar, anggota, email, cadangan, dan APK tablet. */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Daftarkan perangkat ini mengakhiri sesi orang dewasa; Next merender ulang halaman ini di respons
  // action yang sama. Browser itu sekarang tablet learner, jadi langsung ke halaman pilih learner.
  if (!(await getActor()) && (await getDevice())) redirect('/')
  const actor = await pageActor(['tutor'], '/konsol/pengaturan')
  const sp = await searchParams
  const data = await load(() => settingsDTO(actor, spUuid(sp, 'learner')))
  return (
    <SettingsClient
      data={data}
      actions={{
        updateLearnerLimits: updateLearnerLimitsAction,
        revokeDevice: revokeDeviceAction,
        renameDevice: renameDeviceAction,
        removePasskey: removePasskeyAction,
        inviteMember: inviteMemberAction,
        revokeInvite: revokeInviteAction,
        changePassword: changePasswordAction,
      }}
    />
  )
}
