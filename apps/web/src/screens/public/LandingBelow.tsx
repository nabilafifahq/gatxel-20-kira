import Link from 'next/link'
import type { ReactElement } from 'react'
import { SubjectIcon } from '@/components/learner/SubjectIcon'
import { UiIcon, type UiIconName } from '@/components/ui/icons'
import { KiraStar } from '@/components/ui/KiraStar'

/**
 * Bagian tenang di bawah lipatan halaman depan: cara kerja, mapel dan fitur, untuk orang tua dan anak.
 * Hanya fakta yang bisa dibuktikan dari produk: tanpa testimoni, statistik, atau logo yang dikarang.
 */

const STEPS = [
  { n: 1, title: 'Daftar dan konfirmasi email', body: 'Isi nama, email, dan password. Satu email konfirmasi, lalu keluarga Kira kamu siap.' },
  { n: 2, title: 'Tambah anak dan pilih jalur', body: 'Isi nama dan kelas, lalu pakai jalur rekomendasi sekali ketuk atau atur sendiri.' },
  { n: 3, title: 'Anak mulai belajar', body: 'Anak masuk dengan PIN gambar di tablet atau HP, dan kamu membaca laporannya.' },
]

const SUBJECTS = [
  { key: 'math', name: 'Math', body: 'Bilangan, bangun, dan soal cerita yang naik tingkat sedikit demi sedikit.' },
  { key: 'english', name: 'English', body: 'Kosakata, tata bahasa, membaca, dan menyimak dengan suara yang konsisten.' },
  { key: 'science', name: 'Science', body: 'Makhluk hidup, benda, bumi, dan cara kerja alam sehari-hari.' },
] as const

const FEATURES: { icon: UiIconName; label: string }[] = [
  { icon: 'bolt', label: 'Quick Maths' },
  { icon: 'globe', label: 'Quiz Arena' },
  { icon: 'book', label: 'Ruang Baca' },
  { icon: 'cards', label: 'Kartu belajar' },
  { icon: 'search', label: 'Kamus' },
  { icon: 'star', label: 'Dunia Kira' },
]

const FOR_PARENTS = [
  'Jalur belajar siap pakai, atau atur mapel dan fitur per anak.',
  'Batas waktu layar dan izin data per tujuan.',
  'Laporan mingguan: yang sudah dikuasai dan yang perlu diulang.',
  'Hapus akun dan data anak kapan saja.',
]

const FOR_CHILDREN = [
  'Masuk dengan PIN gambar, tanpa email.',
  'Tiga perhentian belajar yang jelas setiap hari.',
  'Soal mengikuti kemampuan, dan yang sulit muncul lagi nanti.',
  'Bintang dan hadiah dari belajar, tanpa kolom obrolan dan tanpa profil publik.',
]

function Check({ text }: { text: string }): ReactElement {
  return (
    <li className="flex items-start gap-2.5 text-body">
      <UiIcon name="check-circle" size={20} className="mt-1 flex-none" />
      <span>{text}</span>
    </li>
  )
}

export function LandingBelow({ full }: { full: boolean }): ReactElement {
  return (
    <div className="flex flex-col gap-14 bg-bg px-4 py-14">
      {full ? (
        <section aria-labelledby="layak-ditunggu" className="mx-auto w-full max-w-[1120px] rounded-card bg-lavender p-6">
          <h2 id="layak-ditunggu" className="m-0 text-h2 font-bold">
            Kenapa layak ditunggu
          </h2>
          <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
            <Check text="Anak belajar sedikit tiap hari, dengan soal yang naik tingkat pelan-pelan dari kelas 1 sampai 6." />
            <Check text="Kamu yang mengatur: batas waktu layar, izin data per tujuan, dan hapus akun anak kapan saja." />
            <Check text="Anak masuk dengan PIN gambar, tanpa email dan tanpa profil publik. Tidak ada iklan." />
            <Check text="Kamu membaca ringkasan mingguan dan tahu apa yang sudah dan belum dikuasai anak." />
          </ul>
          <p className="m-0 mt-4 text-body">Yang lebih dulu masuk daftar dikabari lebih dulu.</p>
        </section>
      ) : null}

      <section aria-labelledby="cara-kerja" className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
        <h2 id="cara-kerja" className="m-0 text-h1 font-bold max-sm:text-h2">
          Cara kerjanya
        </h2>
        <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col gap-2 rounded-card bg-surface p-6 shadow-soft">
              <span aria-hidden="true" className="inline-flex size-10 items-center justify-center rounded-pill bg-lilac font-numbers text-h3 font-bold">
                {s.n}
              </span>
              <h3 className="m-0 text-h3 font-bold">{s.title}</h3>
              <p className="m-0 text-body text-fg-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="mapel-fitur" className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
        <h2 id="mapel-fitur" className="m-0 text-h1 font-bold max-sm:text-h2">
          Mapel dan fitur
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-3">
          {SUBJECTS.map((s) => (
            <li key={s.key} className="flex flex-col gap-2 rounded-card bg-surface p-6 shadow-soft">
              <SubjectIcon subject={s.key} size={40} />
              <h3 className="m-0 text-h3 font-bold">{s.name}</h3>
              <p className="m-0 text-body text-fg-muted">{s.body}</p>
            </li>
          ))}
        </ul>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {FEATURES.map((f) => (
            <li key={f.label} className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-lavender px-4 text-body font-bold">
              <UiIcon name={f.icon} size={20} />
              {f.label}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="untuk-siapa" className="mx-auto flex w-full max-w-[1120px] flex-col gap-6">
        <h2 id="untuk-siapa" className="m-0 text-h1 font-bold max-sm:text-h2">
          Untuk orang tua dan anak
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-soft">
            <h3 className="m-0 text-h3 font-bold">Untuk orang tua</h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {FOR_PARENTS.map((t) => (
                <Check key={t} text={t} />
              ))}
            </ul>
            <Link href="/panduan" prefetch={false} className="inline-flex min-h-11 items-center font-bold underline underline-offset-3">
              Baca panduan orang tua
            </Link>
          </div>
          <div className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-soft">
            <div className="flex items-center gap-3">
              <KiraStar size={36} animate={false} />
              <h3 className="m-0 text-h3 font-bold">Untuk anak</h3>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {FOR_CHILDREN.map((t) => (
                <Check key={t} text={t} />
              ))}
            </ul>
            <Link href="/panduan/anak" prefetch={false} className="inline-flex min-h-11 items-center font-bold underline underline-offset-3">
              Baca panduan untuk anak
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
