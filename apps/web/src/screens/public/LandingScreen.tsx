import Link from 'next/link'
import { ButtonLink } from '@/components/console/Button'
import { SeatsFull } from './SeatsFull'

/**
 * Halaman depan publik Kira (pengunjung tanpa sesi dan tanpa tablet terdaftar).
 * Hanya fakta yang bisa dibuktikan dari produk: tidak ada testimoni, statistik, atau logo yang dikarang.
 * Kalimat kurikulum datang dari KIRA_CURRICULUM_CLAIM (kosong menyembunyikannya).
 */
export type LandingProps = {
  seats: { total: number; taken: number; left: number; full: boolean }
  curriculumClaim: string | null
  turnstileSiteKey: string | null
}

const SUBJECTS = [
  {
    key: 'math',
    name: 'Math',
    pill: 'bg-math-50 text-math',
    body: 'Hitung, bilangan, bangun, dan soal cerita. Soalnya naik tingkat sedikit demi sedikit, dan soal yang masih sulit muncul lagi beberapa hari kemudian sampai anak lancar.',
  },
  {
    key: 'english',
    name: 'English',
    pill: 'bg-english-50 text-english',
    body: 'Kosakata, tata bahasa, dan membaca pendek. Ada soal yang dibacakan dengan suara yang sama setiap hari, jadi anak terbiasa mendengar satu suara yang konsisten.',
  },
  {
    key: 'science',
    name: 'Science',
    pill: 'bg-science-50 text-science',
    body: 'Makhluk hidup, benda dan sifatnya, bumi, serta cara kerja alam sehari-hari. Dengan gambar yang jelas dan kalimat yang pendek.',
  },
] as const

const STEPS = [
  { n: 1, title: 'Daftar dengan email', body: 'Isi nama, email, dan password. Kami kirim satu email berisi tombol konfirmasi.' },
  { n: 2, title: 'Konfirmasi email', body: 'Saat tombol ditekan, keluarga Kira kamu dibuat dan satu kursi beta menjadi milikmu.' },
  { n: 3, title: 'Tambahkan anak', body: 'Pilih nama panggilan, kelas, avatar, dan PIN gambar. Lalu atur izin data satu per satu. Tidak ada yang tercentang dari awal.' },
  { n: 4, title: 'Buka di tablet anak', body: 'Satu tombol menyiapkan perangkat anak. Besok pagi anak sudah bisa mulai, tanpa bantuan orang lain.' },
]

export function LandingScreen({ seats, curriculumClaim, turnstileSiteKey }: LandingProps) {
  return (
    <div className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="mx-auto flex w-full max-w-[1120px] items-center gap-4 px-4 pt-6">
        <Link href="/" className="font-display text-h1 leading-9 font-bold text-fg no-underline hover:text-fg">
          Kira
        </Link>
        <nav aria-label="Menu utama" className="ml-auto flex items-center gap-2 sm:gap-4">
          <Link href="/panduan" className="hidden min-h-11 items-center font-bold sm:inline-flex">
            Panduan
          </Link>
          <Link href="/masuk" className="inline-flex min-h-11 items-center font-bold">
            Masuk
          </Link>
          <ButtonLink href={seats.full ? '#daftar-tunggu' : '/daftar'} variant="primary" scroll>
            {seats.full ? 'Daftar tunggu' : 'Daftar'}
          </ButtonLink>
        </nav>
      </header>

      <main id="isi" className="flex-1">
        <section aria-labelledby="hero-judul" className="mx-auto grid w-full max-w-[1120px] gap-10 px-4 pt-14 pb-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="flex flex-col gap-6">
            <h1 id="hero-judul" className="m-0 font-display text-display font-semibold max-sm:text-[44px] max-sm:leading-[48px]">
              Belajar sedikit tiap hari, sampai jadi kebiasaan.
            </h1>
            <p className="m-0 max-w-[52ch] text-body-lg text-fg-muted">
              Kira adalah ruang belajar harian untuk anak SD kelas 1 sampai 6. Setiap hari anak mengerjakan beberapa soal Math, English, dan Science yang pas dengan kemampuannya. Orang tua tinggal mengatur dan membaca ringkasannya.
            </p>
            {curriculumClaim ? <p className="m-0 max-w-[52ch] text-body text-fg-muted">{curriculumClaim}</p> : null}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <ButtonLink href={seats.full ? '#daftar-tunggu' : '/daftar'} variant="primary" className="h-12! px-6!">
                {seats.full ? 'Masuk daftar tunggu' : 'Daftar kursi beta'}
              </ButtonLink>
              <p className="m-0 text-body font-semibold" aria-live="polite">
                {seats.full ? 'Kursi beta sudah penuh.' : `Tersisa ${seats.left} dari ${seats.total} kursi.`}
              </p>
            </div>
          </div>
          <div aria-hidden="true" className="rounded-card border border-divider bg-surface p-6 shadow-sm max-lg:hidden">
            <p className="m-0 text-small font-bold text-fg-muted">Latihan hari ini</p>
            <ol className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
              <li className="flex items-center gap-3 rounded-control bg-math-50 px-4 py-3 text-math">
                <span className="font-display text-h2 font-semibold">1</span>
                <span className="text-body font-bold">Math, 8 soal</span>
              </li>
              <li className="flex items-center gap-3 rounded-control bg-english-50 px-4 py-3 text-english">
                <span className="font-display text-h2 font-semibold">2</span>
                <span className="text-body font-bold">English, 8 soal</span>
              </li>
              <li className="flex items-center gap-3 rounded-control bg-science-50 px-4 py-3 text-science">
                <span className="font-display text-h2 font-semibold">3</span>
                <span className="text-body font-bold">Science, 8 soal</span>
              </li>
            </ol>
            <p className="m-0 mt-5 font-reading text-body-lg">Berapa hasil 6 + 7?</p>
          </div>
        </section>

        <section aria-labelledby="untuk-siapa" className="border-y border-divider bg-surface">
          <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 py-14 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h2 id="untuk-siapa" className="m-0 text-h1 font-bold max-sm:text-h2">
                Untuk anak SD kelas 1 sampai 6
              </h2>
              <p className="m-0 max-w-[56ch] text-body-lg text-fg-muted">
                Anak membuka Kira, melihat tiga perhentian untuk hari itu, dan mengerjakannya satu per satu. Tampilan dan ukuran huruf menyesuaikan kelasnya, dari kelas 1 yang masih belajar membaca sampai kelas 6.
              </p>
              <p className="m-0 max-w-[56ch] text-body text-fg-muted">
                Setiap anak punya jalur sendiri. Kira mencatat apa yang sudah lancar dan apa yang perlu diulang, lalu memilih soal berikutnya dari situ.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="m-0 text-h3 font-bold">Tiga mata pelajaran</h3>
              <dl className="m-0 flex flex-col gap-5">
                {SUBJECTS.map((s) => (
                  <div key={s.key} className="flex flex-col gap-1.5">
                    <dt>
                      <span className={`inline-block rounded-pill px-3 py-0.5 text-body font-bold ${s.pill}`}>{s.name}</span>
                    </dt>
                    <dd className="m-0 text-body text-fg-muted">{s.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section aria-labelledby="arena" className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 py-14 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 id="arena" className="m-0 text-h1 font-bold max-sm:text-h2">
              Latihan seru setelah pelajaran
            </h2>
            <p className="m-0 max-w-[56ch] text-body-lg text-fg-muted">Dua arena untuk anak yang ingin lanjut bermain sambil berlatih.</p>
          </div>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <h3 className="m-0 text-h3 font-bold">Quick Maths</h3>
              <p className="m-0 text-body text-fg-muted">
                Berhitung cepat melawan waktu: sprint 60 atau 120 detik, atau target 20 soal. Anak melihat kecepatan dan ketepatannya naik dari minggu ke minggu.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 className="m-0 text-h3 font-bold">Quiz Arena</h3>
              <p className="m-0 text-body text-fg-muted">
                Kuis pengetahuan umum per topik, dengan gambar dan bendera. Fakta yang sudah dikenal anak tercatat, jadi tiap ronde terasa maju.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="ortu" className="border-y border-divider bg-surface">
          <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 py-14 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h2 id="ortu" className="m-0 text-h1 font-bold max-sm:text-h2">
                Orang tua yang memegang kendali
              </h2>
              <p className="m-0 max-w-[56ch] text-body-lg text-fg-muted">Kamu membuat akun anak sendiri dan memutuskan apa yang boleh disimpan.</p>
            </div>
            <ul className="m-0 flex list-disc flex-col gap-3 pl-5 text-body">
              <li>Batas waktu layar harian untuk setiap anak.</li>
              <li>Izin data per tujuan: belajar, laporan email, rekaman suara, dan foto jawaban. Tidak ada yang tercentang dari awal.</li>
              <li>Ringkasan mingguan: apa yang sudah dikuasai, apa yang perlu diulang, dan berapa lama anak belajar.</li>
              <li>Anak masuk dengan PIN gambar di perangkatnya. Kamu masuk dengan email dan password, atau passkey.</li>
              <li>Hapus akun dan data anak kapan saja dari halaman Privasi keluarga, dan unduh salinan datanya.</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="aman" className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 py-14 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 id="aman" className="m-0 text-h1 font-bold max-sm:text-h2">
              Aman dan menghormati privasi
            </h2>
            <p className="m-0 max-w-[56ch] text-body-lg text-fg-muted">Data anak hanya dipakai untuk belajar, dan kamu bisa membaca aturannya dengan bahasa biasa.</p>
          </div>
          <ul className="m-0 flex list-disc flex-col gap-3 pl-5 text-body">
            <li>Tidak ada iklan, dan anak tidak punya profil publik atau kolom obrolan.</li>
            <li>Selama beta, tidak ada data anak yang dikirim ke layanan kecerdasan buatan.</li>
            <li>Kata sandi disimpan dalam bentuk acak satu arah, dan PIN anak juga.</li>
            <li>
              Aturan lengkapnya ada di{' '}
              <Link href="/privasi" className="font-bold">
                Kebijakan Privasi
              </Link>{' '}
              dan{' '}
              <Link href="/ketentuan" className="font-bold">
                Syarat dan Ketentuan
              </Link>
              .
            </li>
          </ul>
        </section>

        <section aria-labelledby="beta" className="border-y border-divider bg-surface">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-4 py-14">
            <div className="flex flex-col gap-3">
              <h2 id="beta" className="m-0 text-h1 font-bold max-sm:text-h2">
                Cara kerja beta
              </h2>
              <p className="m-0 max-w-[60ch] text-body-lg text-fg-muted">
                Kira dibuka bertahap untuk {seats.total} keluarga. Fiturnya masih bertambah, jadi kamu mungkin melihat perubahan dari minggu ke minggu.
              </p>
            </div>
            <ol className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-4">
                  <span aria-hidden="true" className="font-display text-display leading-[56px] font-semibold text-fg-muted max-sm:text-h1">
                    {s.n}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="m-0 text-h3 font-bold">{s.title}</h3>
                    <p className="m-0 text-body text-fg-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {seats.full ? (
          <div className="mx-auto w-full max-w-[1120px] px-4 py-14">
            <SeatsFull turnstileSiteKey={turnstileSiteKey} headingLevel={2} />
          </div>
        ) : (
          <section aria-labelledby="ajak" className="mx-auto flex w-full max-w-[1120px] flex-col items-start gap-4 px-4 py-14">
            <h2 id="ajak" className="m-0 text-h1 font-bold max-sm:text-h2">
              Mulai dari satu kursi
            </h2>
            <p className="m-0 max-w-[56ch] text-body-lg text-fg-muted">
              Tersisa {seats.left} dari {seats.total} kursi. Pendaftaran memakan beberapa menit, dan anak bisa belajar di hari yang sama.
            </p>
            <ButtonLink href="/daftar" variant="primary" className="h-12! px-6!">
              Daftar kursi beta
            </ButtonLink>
          </section>
        )}
      </main>

      <footer className="border-t border-divider">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5 text-body">
          <Link href="/panduan" className="inline-flex min-h-11 items-center font-bold">
            Panduan orang tua
          </Link>
          <Link href="/panduan/anak" className="inline-flex min-h-11 items-center font-bold">
            Panduan untuk anak
          </Link>
          <Link href="/privasi" className="inline-flex min-h-11 items-center font-bold">
            Kebijakan Privasi
          </Link>
          <Link href="/ketentuan" className="inline-flex min-h-11 items-center font-bold">
            Syarat dan Ketentuan
          </Link>
          <Link href="/masuk" className="inline-flex min-h-11 items-center font-bold sm:ml-auto">
            Masuk
          </Link>
        </div>
      </footer>
    </div>
  )
}
