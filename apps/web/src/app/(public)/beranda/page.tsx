import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LandingScreen } from '@/screens/public/LandingScreen'
import { getActor, homeFor } from '@/server/auth/actor'
import { turnstileSiteKey } from '@/server/auth/turnstile'
import { curriculumClaim } from '@/server/signup/claims'
import { seatInfo } from '@/server/signup/service'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: { absolute: 'Kira, belajar harian untuk anak SD kelas 1 sampai 6' },
  description: 'Latihan Math, English, dan Science setiap hari, dengan kendali penuh di tangan orang tua. Beta terbatas 100 keluarga.',
}

/** Halaman depan publik. Diakses lewat alamat / oleh pengunjung tanpa sesi dan tanpa tablet terdaftar (lihat proxy.ts). */
export default async function LandingPage() {
  const actor = await getActor()
  if (actor) redirect(homeFor(actor.role))
  return <LandingScreen seats={await seatInfo()} curriculumClaim={curriculumClaim()} turnstileSiteKey={turnstileSiteKey()} />
}
