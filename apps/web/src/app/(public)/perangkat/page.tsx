import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RegisterDeviceScreen } from '@/screens/public/RegisterDeviceScreen'
import { getActor, pageActor } from '@/server/auth/actor'
import { getDevice } from '@/server/auth/device'
import { registerDeviceAction } from '@/server/actions/auth'
import { registerableLearners } from '@/server/dal/learner-entry'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Daftarkan tablet' }

/** Orang dewasa mendaftarkan browser ini sebagai tablet learner (orang tua hanya untuk anaknya sendiri). */
export default async function RegisterDevicePage() {
  // Mendaftarkan perangkat mengakhiri sesi orang dewasa dan Next merender ulang halaman ini di respons
  // action yang sama. Browser ini sekarang tablet learner, jadi langsung ke halaman pilih learner.
  if (!(await getActor()) && (await getDevice())) redirect('/')
  const actor = await pageActor(['tutor', 'guardian'], '/perangkat')
  const learners = await registerableLearners(actor)
  return <RegisterDeviceScreen learners={learners} registered={null} registerDevice={registerDeviceAction} />
}
