import type { Metadata } from 'next'
import { guideMetadata } from '@/screens/public/panduan/metadata'
import { ParentGuide } from '@/screens/public/panduan/ParentGuide'
import { origin } from '@/server/env'
import { privacyNoticeData } from '@/server/legal'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return guideMetadata(origin(), {
    title: 'Panduan Kira untuk orang tua',
    description: 'Mulai dalam 5 menit, cara kerja setiap fitur dengan contoh anak, apa saja yang bisa diatur, dan jawaban jujur tentang data, biaya, dan kerangka Cambridge Primary.',
    path: '/panduan',
  })
}

/** Panduan orang tua. Publik, tanpa masuk. Alamat kontak selalu dari konfigurasi hukum (KIRA_LEGAL_EMAIL). */
export default function ParentGuidePage() {
  return <ParentGuide contact={privacyNoticeData().entity.email} />
}
