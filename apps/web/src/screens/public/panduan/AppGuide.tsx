import Link from 'next/link'
import { ButtonLink } from '@/components/console/Button'
import { UiIcon } from '@/components/ui/icons'
import { KiraStar } from '@/components/ui/KiraStar'
import { GuideFrame } from './GuideFrame'
import { IconTile, Steps } from './parts'

export type AppGuideProps = {
  /** Alamat publik Kira, dari KIRA_ORIGIN. */
  origin: string
  who: 'adult' | 'child' | 'visitor'
  apk: { available: boolean; size: string | null }
}

/** Gambar HP sederhana dengan isi layar yang menjelaskan satu langkah. Hiasan: langkahnya ada di teks. */
function PhoneFigure({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 120 200" width="120" height="200" role="img" aria-label={label} className="h-auto w-[72px] flex-none sm:w-[120px]">
      <rect x="6" y="4" width="108" height="192" rx="18" className="fill-surface stroke-fg" strokeWidth="3" />
      <rect x="46" y="11" width="28" height="4" rx="2" className="fill-lavender" />
      {children}
    </svg>
  )
}

const FIGURES = {
  allow: (
    <PhoneFigure label="Layar HP dengan sakelar izin yang menyala">
      <rect x="18" y="44" width="84" height="44" rx="10" className="fill-lavender" />
      <rect x="28" y="54" width="44" height="6" rx="3" className="fill-fg" />
      <rect x="28" y="68" width="30" height="6" rx="3" className="fill-fg" opacity=".45" />
      <rect x="76" y="58" width="20" height="12" rx="6" className="fill-fg" />
      <circle cx="90" cy="64" r="4" className="fill-surface" />
      <rect x="18" y="100" width="84" height="8" rx="4" className="fill-lavender" />
      <rect x="18" y="116" width="60" height="8" rx="4" className="fill-lavender" />
    </PhoneFigure>
  ),
  download: (
    <PhoneFigure label="Layar HP dengan tombol unduh dan panah ke bawah">
      <circle cx="60" cy="74" r="28" className="fill-yellow stroke-fg" strokeWidth="3" />
      <path d="M60 60v26M49 76l11 11 11-11" fill="none" className="stroke-fg" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="22" y="122" width="76" height="26" rx="10" className="fill-lavender stroke-fg" strokeWidth="2.5" />
      <rect x="36" y="132" width="48" height="6" rx="3" className="fill-fg" />
    </PhoneFigure>
  ),
  open: (
    <PhoneFigure label="Layar HP dengan berkas aplikasi dan tombol instal">
      <rect x="40" y="42" width="40" height="48" rx="8" className="fill-sky stroke-fg" strokeWidth="3" />
      <path d="M53 66l5 5 10-11" fill="none" className="stroke-fg" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="26" y="104" width="68" height="6" rx="3" className="fill-lavender" />
      <rect x="22" y="130" width="76" height="26" rx="10" className="fill-fg" />
      <rect x="40" y="140" width="40" height="6" rx="3" className="fill-surface" />
    </PhoneFigure>
  ),
  login: (
    <PhoneFigure label="Layar HP dengan kolom masuk">
      <circle cx="60" cy="54" r="16" className="fill-yellow stroke-fg" strokeWidth="3" />
      <rect x="22" y="84" width="76" height="20" rx="8" className="fill-surface stroke-fg" strokeWidth="2.5" />
      <rect x="22" y="112" width="76" height="20" rx="8" className="fill-surface stroke-fg" strokeWidth="2.5" />
      <rect x="22" y="144" width="76" height="24" rx="10" className="fill-fg" />
      <rect x="44" y="153" width="32" height="6" rx="3" className="fill-surface" />
    </PhoneFigure>
  ),
}

function DownloadCard({ who, apk }: Pick<AppGuideProps, 'who' | 'apk'>) {
  return (
    <section aria-labelledby="unduh-judul" className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-soft max-sm:p-5">
      <h2 id="unduh-judul" className="m-0 text-h2 font-semibold">
        Unduh aplikasi Android
      </h2>
      {who === 'adult' && apk.available ? (
        <>
          <p className="m-0">Berkas ini khusus untuk orang tua yang sudah masuk.{apk.size ? ` Ukurannya ${apk.size}, jadi sebaiknya pakai Wi-Fi.` : ''}</p>
          <div>
            <ButtonLink href="/api/apk" variant="primary" icon="download" external>
              Unduh aplikasi Android
            </ButtonLink>
          </div>
        </>
      ) : null}
      {who === 'adult' && !apk.available ? (
        <p className="m-0" role="status">
          Berkas aplikasi sedang disiapkan. Tombol unduh muncul di sini dan di halaman Keluarga begitu siap. Sementara itu Kira bisa langsung dibuka lewat browser HP atau tablet.
        </p>
      ) : null}
      {who === 'visitor' ? (
        <>
          <p className="m-0">Aplikasi Android bisa diunduh setelah Ayah/Bunda masuk ke akun Kira. Belum punya akun? Daftar dulu, gratis selama beta.</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/masuk?next=/panduan/aplikasi" variant="primary" prefetch={false}>
              Masuk untuk mengunduh
            </ButtonLink>
            <ButtonLink href="/daftar" variant="secondary" prefetch={false}>
              Daftar kursi beta
            </ButtonLink>
          </div>
        </>
      ) : null}
      {who === 'child' ? <p className="m-0">Perangkat ini sedang dipakai anak. Minta Ayah/Bunda membuka halaman ini lewat akun orang tua untuk mengunduh aplikasi.</p> : null}
    </section>
  )
}

/** Panduan memasang Kira: aplikasi Android untuk orang tua yang sudah masuk, dan website di iPad atau iPhone. */
export function AppGuide({ origin, who, apk }: AppGuideProps) {
  const host = origin.replace(/^https?:\/\//, '')
  return (
    <GuideFrame tab="aplikasi">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8">
        <header className="flex items-center gap-5 rounded-xl bg-lavender p-8 max-sm:flex-col max-sm:items-start max-sm:p-6">
          <KiraStar size={88} />
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-h1 font-semibold">Pasang Kira di HP atau tablet</h1>
            <p className="m-0 text-body-lg">Android memakai aplikasi Kira. iPad dan iPhone memakai website Kira di Safari. Isinya sama, dan akunnya sama.</p>
          </div>
        </header>

        <DownloadCard who={who} apk={apk} />

        <section aria-labelledby="android-judul" className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <IconTile tone="sky">
              <UiIcon name="arrow-down" size={26} />
            </IconTile>
            <h2 id="android-judul" className="m-0 text-h2 font-semibold">
              Android, langkah demi langkah
            </h2>
          </div>
          <p className="m-0">Butuh Android 8.0 atau lebih baru. Aplikasi ini dipasang langsung dari Kira, belum lewat Play Store, jadi Android akan meminta izin dulu. Kerjakan di perangkat yang akan dipakai anak.</p>

          {[
            {
              fig: FIGURES.allow,
              title: 'Izinkan pemasangan dari sumber ini',
              body: 'Buka Setelan, cari Instal aplikasi tidak dikenal, pilih Chrome, lalu nyalakan Izinkan dari sumber ini. Nama menunya bisa sedikit berbeda antarmerek HP. Kalau langkah ini terlewat, Android menanyakannya sendiri saat berkas dibuka.',
            },
            {
              fig: FIGURES.download,
              title: 'Unduh berkasnya',
              body: 'Masuk ke akun Kira di Chrome, buka halaman ini, lalu tekan Unduh aplikasi Android. Tombol yang sama ada di halaman Keluarga, dengan nama Unduh aplikasi tablet. Kalau Chrome bertanya apakah berkas tetap ingin diunduh, pilih tetap unduh.',
            },
            {
              fig: FIGURES.open,
              title: 'Buka dan pasang',
              body: 'Ketuk kira.apk di notifikasi unduhan, lalu tekan Instal. Peringatan Play Protect wajar muncul untuk aplikasi di luar Play Store; pilih detail selengkapnya, lalu tetap instal. Setelah selesai, izin di langkah 1 boleh dimatikan lagi.',
            },
            {
              fig: FIGURES.login,
              title: 'Buka Kira dan masuk',
              body: 'Tekan Masuk, lalu Masuk sebagai anak, ketik kode keluarga dari halaman Keluarga, pilih nama, lalu tekan PIN gambar. Bisa juga masuk dengan email dan password Ayah/Bunda, lalu tekan Daftarkan perangkat ini. Sejak itu perangkat menampilkan pilihan nama anak dan PIN gambar.',
            },
          ].map((s, i) => (
            <div key={s.title} className="flex items-start gap-4 rounded-card bg-surface p-5 shadow-soft sm:items-center sm:gap-5">
              {s.fig}
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="m-0 text-h3 font-semibold">
                  <span className="font-numbers tabular-nums">{i + 1}.</span> {s.title}
                </h3>
                <p className="m-0">{s.body}</p>
              </div>
            </div>
          ))}
        </section>

        <section aria-labelledby="perbarui-judul" className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-soft max-sm:p-5">
          <h2 id="perbarui-judul" className="m-0 text-h2 font-semibold">
            Cara pembaruan bekerja
          </h2>
          <p className="m-0">Aplikasi Kira membuka website Kira, jadi soal, tampilan, dan fitur baru masuk dengan sendirinya setiap kali aplikasi dibuka. Tidak ada yang perlu ditekan.</p>
          <p className="m-0">Sesekali ada versi baru dari berkas aplikasinya. Unduh lagi dari halaman ini, lalu pasang di atas aplikasi yang lama, tanpa mencopotnya dulu. Perangkat tetap terdaftar. Kalau aplikasi dicopot, perangkat perlu didaftarkan ulang, sedangkan data belajar anak tetap aman di server.</p>
        </section>

        <section aria-labelledby="ios-judul" className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-soft max-sm:p-5">
          <div className="flex items-center gap-3">
            <IconTile tone="yellow">
              <UiIcon name="globe" size={26} />
            </IconTile>
            <h2 id="ios-judul" className="m-0 text-h2 font-semibold">
              iPad dan iPhone
            </h2>
          </div>
          <p className="m-0">Belum ada aplikasi Kira untuk iPad dan iPhone. Website Kira berjalan di Safari dan bisa ditaruh di layar utama supaya terasa seperti aplikasi. Anak tidak butuh email: cukup kode keluarga, nama, dan PIN gambar.</p>
          <Steps
            items={[
              <>Buka Safari, lalu ketik {host}.</>,
              'Ketuk tombol Bagikan (kotak dengan panah ke atas).',
              'Pilih Tambah ke Layar Utama, lalu ketuk Tambah.',
              'Buka Kira dari ikon baru itu, tekan Masuk, lalu Masuk sebagai anak, dan ketik kode keluarga dari halaman Keluarga.',
              'Anak memilih namanya dan menekan PIN gambar. Berikutnya anak tinggal memilih nama dan PIN. Kalau kode diminta lagi saat membuka ikon itu pertama kali, ketik sekali lagi.',
            ]}
          />
        </section>

        <section aria-labelledby="browser-judul" className="flex flex-col gap-2 rounded-card bg-lavender p-6 max-sm:p-5">
          <h2 id="browser-judul" className="m-0 text-h3 font-semibold">
            Tanpa memasang apa pun
          </h2>
          <p className="m-0">
            Aplikasi tidak wajib. Kira juga berjalan di browser Android dan di komputer. Langkah sesudah masuk ada di <Link href="/panduan#mulai" prefetch={false}>Mulai dalam 5 menit</Link>. Ada kendala saat memasang? Tulis di <Link href="/feedback" prefetch={false}>halaman bantuan</Link>.
          </p>
        </section>
      </div>
    </GuideFrame>
  )
}
