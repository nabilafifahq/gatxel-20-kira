import type { Metadata } from 'next'
import { siteAccount } from '@/server/site-account'
import { GuideLayout, GuideSection } from '@/screens/public/GuideLayout'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Panduan untuk anak' }

/** Panduan singkat untuk anak, dibaca bersama orang tua. Kalimat pendek, satu langkah per bagian. */
export default async function KidsGuidePage() {
  return (
    <GuideLayout
      account={await siteAccount()}
      title="Panduan untuk anak"
      intro="Halo! Ini cara belajar di Kira. Baca bersama Mama atau Papa kalau perlu."
      other={{ href: '/panduan', label: 'Panduan orang tua' }}
    >
      <GuideSection id="masuk" title="Cara masuk">
        <p className="m-0">Buka Kira di tabletmu. Ketuk gambar dan namamu. Lalu ketuk empat gambar PIN-mu, urut seperti yang kamu buat. Selesai!</p>
        <p className="m-0">Lupa PIN? Tidak apa-apa. Minta Mama atau Papa membantu membuat PIN baru.</p>
      </GuideSection>
      <GuideSection id="today" title="Belajar hari ini">
        <p className="m-0">Di halaman Today ada beberapa perhentian. Kerjakan satu per satu, dari yang paling besar. Baca soalnya pelan-pelan. Kalau ada tombol speaker, ketuk untuk mendengar soalnya.</p>
        <p className="m-0">Salah itu wajar. Setiap soal yang salah akan muncul lagi nanti, supaya kamu makin lancar.</p>
      </GuideSection>
      <GuideSection id="arena" title="Bermain di arena">
        <p className="m-0">Quick Maths: berhitung cepat melawan waktu. Coba kalahkan rekormu sendiri.</p>
        <p className="m-0">Quiz Arena: kuis tentang dunia, dengan gambar dan bendera. Makin sering main, makin banyak fakta yang kamu tahu.</p>
      </GuideSection>
      <GuideSection id="istirahat" title="Istirahat juga penting">
        <p className="m-0">Kalau waktu layar hari ini habis, Kira akan bilang. Saatnya main di luar, minum air, atau membaca buku.</p>
      </GuideSection>
    </GuideLayout>
  )
}
