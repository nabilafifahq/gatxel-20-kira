import type { Metadata } from 'next'
import { AppGuide } from '@/screens/public/panduan/AppGuide'
import { guideMetadata } from '@/screens/public/panduan/metadata'
import { getSession } from '@/server/auth/session'
import { apkInfo } from '@/server/dal/console-settings'
import { origin } from '@/server/env'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return guideMetadata(origin(), {
    title: 'Pasang aplikasi Kira',
    description: 'Cara memasang aplikasi Android Kira langkah demi langkah, dan cara memakai Kira di iPad atau iPhone lewat Safari.',
    path: '/panduan/aplikasi',
  })
}

/**
 * Panduan memasang aplikasi. Halamannya publik; berkas APK tetap hanya untuk orang dewasa yang masuk,
 * dan /api/apk memeriksa sesi itu sendiri, jadi halaman ini hanya memilih tombol yang ditampilkan.
 */
export default async function AppGuidePage() {
  const session = await getSession()
  const who = !session ? 'visitor' : session.role === 'learner' ? 'child' : 'adult'
  const apk = who === 'adult' ? await apkInfo() : { available: false, size: null }
  return <AppGuide origin={origin()} who={who} apk={{ available: apk.available, size: apk.size }} />
}
