import type { Metadata } from 'next'
import { KidsGuide } from '@/screens/public/panduan/KidsGuide'
import { guideMetadata } from '@/screens/public/panduan/metadata'
import { origin } from '@/server/env'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return guideMetadata(origin(), {
    title: 'Panduan Kira untuk anak',
    description: 'Cara mulai, sesi hari ini, bintang, teman, dan tetap aman. Gambar besar dan kalimat pendek, enak dibacakan bersama anak.',
    path: '/panduan/anak',
  })
}

/** Panduan untuk anak. Publik, tanpa masuk. */
export default function KidsGuidePage() {
  return <KidsGuide />
}
