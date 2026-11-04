import Link from 'next/link'
import type { ReactNode } from 'react'
import { ConsoleIcon, type ConsoleIconName } from '@/components/console/icons'
import { UiIcon, type UiIconName } from '@/components/ui/icons'
import type { Feature, ShotSpec } from './parts'

/**
 * Isi panduan orang tua. Setiap kalimat diperiksa terhadap kode: angka, batas, dan label tombol di sini
 * harus sama dengan layar. Label layar anak memakai bahasa bawaan (Indonesia). Nama anak dalam contoh semuanya fiktif.
 * Sapaan: Ayah/Bunda, sebisa mungkin tanpa kata ganti.
 */

/** Tautan di dalam kalimat atau langkah. */
export function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} prefetch={false} className="font-bold underline underline-offset-3">
      {children}
    </Link>
  )
}

/** Label yang persis terlihat di layar. */
export function L({ children }: { children: ReactNode }) {
  return <strong className="font-bold">{children}</strong>
}

const ui = (name: UiIconName) => <UiIcon name={name} size={26} />
const con = (name: ConsoleIconName) => <ConsoleIcon name={name} size={26} />
const shot = (src: string, alt: string, caption?: string): ShotSpec => ({ src: `${src}.webp`, alt, width: 585, height: 960, ...(caption ? { caption } : {}) })

export const MULAI: { title: string; body: ReactNode }[] = [
  {
    title: 'Daftar',
    body: (
      <>
        Buka <A href="/daftar">halaman Daftar</A>, isi nama orang tua, email, dan password minimal 15 karakter, centang persetujuan, lalu tekan <L>Daftar</L>.
      </>
    ),
  },
  {
    title: 'Konfirmasi email',
    body: (
      <>
        Buka email dari Kira dalam 24 jam, masukkan lagi password tadi, lalu tekan <L>Konfirmasi email</L>. Satu kursi beta kini milik keluarga.
      </>
    ),
  },
  {
    title: 'Tambahkan anak',
    body: (
      <>
        Isi nama panggilan, kelas, avatar, dan PIN dari empat gambar. Centang izin <L>Belajar di Kira</L>, karena anak baru bisa masuk setelah izin ini disimpan.
      </>
    ),
  },
  {
    title: 'Pilih jalur belajar',
    body: (
      <>
        Tekan <L>Pakai jalur rekomendasi</L> untuk langsung mulai, atau <L>Atur sendiri</L> untuk memilih mapel dan fitur. Kalau dilewati dengan <L>Lewati dulu</L>, Kira memakai jalur rekomendasi. Semuanya bisa diubah kapan saja lewat <A href="#saklar">saklar fitur</A>.
      </>
    ),
  },
  {
    title: 'Berikan akses ke anak',
    body: (
      <>
        Di tablet atau HP anak, buka Kira dan masuk dengan akun Ayah/Bunda sekali saja, lalu tekan <L>Mulai belajar sebagai anak</L>. Perangkat lain bisa ditambah lewat <L>Daftarkan perangkat ini</L> di halaman Keluarga. Akun orang tua keluar otomatis dari perangkat itu. Beri tahu anak urutan empat gambarnya.
      </>
    ),
  },
  {
    title: 'Pasang aplikasi',
    body: (
      <>
        Perangkat Android bisa memakai aplikasi Kira. iPad dan iPhone memakai Safari. Langkahnya ada di <A href="/panduan/aplikasi">panduan aplikasi</A>.
      </>
    ),
  },
]

export type GuideFeature = Feature & { short?: string }
export type Group = { id: string; title: string; intro?: ReactNode; features: GuideFeature[] }

const AKUN: GuideFeature[] = [
  {
    id: 'akun',
    title: 'Akun orang tua',
    icon: con('learners'),
    what: 'Satu akun orang tua memegang satu keluarga. Semua anak dibuat dari akun ini, sampai 5 anak, dan anak tidak perlu punya email.',
    suits: 'Bunda Rina punya Aisha (kelas 2) dan Raka (kelas 4). Cukup satu akun untuk berdua. Masing-masing punya profil, PIN, dan kemajuan sendiri.',
    steps: [
      <>
        Buka <A href="/daftar">halaman Daftar</A>, lalu isi nama orang tua, email, dan password.
      </>,
      'Buat password paling sedikit 15 karakter. Kalimat panjang yang mudah diingat lebih aman daripada kata acak.',
      <>
        Centang persetujuan, lalu tekan <L>Daftar</L>.
      </>,
    ],
    control: (
      <>
        Nama panggilan, kelas, avatar, dan PIN tiap anak ada di halaman anak, bagian <L>Pengaturan</L>. Email sementara tidak diterima, dan satu alamat hanya untuk satu akun. Gmail dengan titik atau tanda plus dihitung sebagai alamat yang sama. Demi keamanan, akun orang tua keluar sendiri setelah 1 jam tidak dipakai.
      </>
    ),
  },
  {
    id: 'verifikasi',
    title: 'Verifikasi email',
    icon: con('mail'),
    what: 'Kursi beta baru menjadi milik keluarga setelah email dikonfirmasi. Langkah ini memastikan alamat itu benar milik Ayah/Bunda.',
    suits: 'Ayah Dimas mendaftar di HP, lalu membaca email di laptop kantor. Tautannya boleh dibuka di perangkat mana pun, selama password yang tadi dibuat masih diingat.',
    steps: [
      'Buka email dari Kira, lalu tekan tautannya. Tautan berlaku 24 jam.',
      'Masukkan lagi password yang tadi dibuat.',
      <>
        Tekan <L>Konfirmasi email</L>. Keluarga dibuat, kursi terisi, dan Ayah/Bunda langsung masuk ke langkah menambahkan anak.
      </>,
    ],
    control: (
      <>
        Email belum sampai? Cek folder spam, lalu tekan <L>Kirim ulang email</L>. Tombol ini bisa dipakai sekali per menit, sampai 5 kali.
      </>
    ),
  },
  {
    id: 'lupa-password',
    title: 'Lupa password',
    icon: con('key'),
    what: 'Password yang terlupa bisa diganti sendiri lewat email.',
    suits: 'Bunda Laras jarang masuk, karena anaknya memakai tablet dengan PIN gambar. Saat ingin membaca rapor bulanan, passwordnya sudah lupa.',
    steps: [
      <>
        Di <A href="/masuk">halaman Masuk</A> tekan <L>Lupa password?</L>, lalu tulis email.
      </>,
      <>
        Buka email dari Kira, lalu tekan <L>Atur ulang password</L>. Tautan berlaku 30 menit dan hanya bisa dipakai sekali.
      </>,
      'Buat password baru, lalu masuk lagi. Semua sesi lama akun itu ikut keluar.',
    ],
    control: 'Jawaban di layar sama, baik email itu terdaftar atau tidak, supaya alamat orang lain tidak bisa ditebak. Setelah 20 kali salah password, akun dikunci 15 menit.',
  },
  {
    id: 'kursi',
    title: 'Kursi dan daftar tunggu',
    icon: con('userPlus'),
    what: 'Beta Kira dibuka untuk 100 keluarga. Satu keluarga memakai satu kursi, berapa pun jumlah anaknya. Kursi terisi saat email dikonfirmasi, jadi formulir yang belum dikonfirmasi belum mengambil kursi.',
    suits: 'Ayah Bima baru menerima tautan setelah kursi habis. Ia mengisi daftar tunggu, lalu mendapat email saat kursi dibuka lagi.',
    steps: [
      <>
        Saat kursi habis, halaman depan dan halaman Daftar menampilkan <L>Kursi beta sudah penuh</L>.
      </>,
      'Tulis email di formulir, centang persetujuan, lalu kirim.',
      <>
        Buka email konfirmasi, lalu tekan <L>Ya, kabari saya</L>.
      </>,
      <>
        Saat kursi dibuka lagi, email berisi tombol <L>Daftar sekarang</L> dikirim menurut urutan pendaftaran. Kursi tidak ditahan, jadi sebaiknya daftar begitu email datang.
      </>,
    ],
    control: 'Setiap email kabar punya tautan berhenti berlangganan. Konfirmasi yang tidak ditekan dihapus setelah 14 hari. Sebuah kursi tetap milik keluarga walaupun seorang anak dihapus.',
  },
]

/** Empat aturan hari dan isinya. Sama dengan PRESET_SESSION_LEVELS di @kira/core. */
function PresetTable() {
  const rows = [
    ['Seimbang', 'Wajib', 'Opsional', 'Opsional'],
    ['Penuh', 'Wajib', 'Wajib', 'Wajib'],
    ['Ringan', 'Wajib', 'Mati', 'Mati'],
  ]
  return (
    <table className="w-full border-collapse text-left text-small">
      <caption className="sr-only">Isi setiap aturan hari</caption>
      <thead>
        <tr className="border-b-2 border-divider">
          {['Aturan', 'Latihan', 'Tes', 'Paper'].map((h) => (
            <th key={h} scope="col" className="py-2 pr-2 font-bold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, ...cells]) => (
          <tr key={name} className="border-b border-divider">
            <th scope="row" className="py-2 pr-2 font-bold">
              {name}
            </th>
            {cells.map((c, i) => (
              <td key={i} className="py-2 pr-2">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const HARI: GuideFeature[] = [
  {
    id: 'today',
    title: 'Hari ini dan sesi',
    icon: ui('sun'),
    what: 'Hari ini (Today) adalah layar pertama anak setiap hari. Isinya sesi hari itu, dibagi menjadi Wajib hari ini dan Tambahan hari ini. Latihan berisi 10 soal dengan petunjuk. Tes berisi 8 soal dengan waktu 75 detik per soal. Paper mini berisi 8 soal dalam 15 menit.',
    suits: 'Aisha kelas 2 belajar sepulang sekolah. Dengan aturan bawaan ia mengerjakan 3 Latihan: Math, English, dan Science. Kalau masih semangat, ia mengambil Tes dari daftar tambahan.',
    steps: [
      <>
        Anak masuk dengan PIN gambar, lalu melihat <L>Hari ini</L>.
      </>,
      'Anak mengetuk satu sesi dan mulai mengerjakan.',
      <>
        Jawaban salah di Latihan membuka petunjuk, sampai 3 kali, dan kesempatan kedua. Kalau masih salah, jawaban dan cara mengerjakannya muncul, lalu soal itu datang lagi di hari lain lewat <L>Ulas lagi</L>.
      </>,
      'Akhir sesi menampilkan 1 sampai 3 bintang: 3 bintang untuk 90 persen benar, 2 bintang untuk 60 persen.',
      'Semua sesi wajib selesai membuka peti hadiah harian, berisi stiker, latar, atau aksesori avatar.',
    ],
    control: (
      <>
        Lihat dan ubah sesi di halaman anak, bagian <L>Sesi hari ini</L>. Hari Sabtu satu mapel mendapat paper penuh 20 soal, bergiliran. Hari Minggu istirahat. Jawaban tulis, bicara, gambar, dan foto tidak dinilai otomatis dan tidak dihitung dalam skor. Ayah/Bunda boleh melihatnya di bagian <L>Hasil tulis, bicara, gambar, dan foto</L>, dan menilainya itu pilihan.
      </>
    ),
    shot: shot('today', 'Layar Hari ini milik anak: sesi wajib per mata pelajaran, jumlah sesi selesai, dan bintang streak.'),
  },
  {
    id: 'wajib-opsional',
    title: 'Sesi wajib atau opsional',
    short: 'Wajib atau opsional',
    icon: con('plan'),
    what: 'Setiap sesi bisa wajib, opsional, atau mati. Hanya sesi wajib yang dihitung untuk streak. Seimbang adalah aturan bawaan, dengan 3 sesi wajib sehari. Penuh berisi 9 sesi wajib. Kustom bisa diatur per hari, per mapel, dan per sesi.',
    extra: <PresetTable />,
    suits: 'Dimas kelas 1 cepat lelah, jadi cocok dengan Ringan. Raka kelas 4 sedang menyiapkan ujian sekolah, jadi bundanya memilih Penuh selama dua minggu lalu kembali ke Seimbang.',
    steps: [
      <>
        Buka <A href="/keluarga">Keluarga</A>, lalu pilih anak.
      </>,
      <>
        Buka <L>Pengaturan</L>, lalu cari <L>Aturan hari</L>.
      </>,
      <>
        Pilih <L>Seimbang</L>, <L>Penuh</L>, <L>Ringan</L>, atau <L>Kustom</L>.
      </>,
      <>
        Untuk Kustom, atur Wajib, Opsional, atau Mati per sesi. <L>Samakan semua hari dengan Senin</L> mempercepat pengisian.
      </>,
      <>
        Tekan <L>Simpan aturan hari</L>.
      </>,
    ],
    control: 'Aturan ini berlaku per anak. Sesi hari ini ikut disesuaikan saat disimpan, dan sesi yang sudah selesai tetap tercatat. Sesi Paper hanya muncul kalau saklar Paper menyala.',
    shot: shot('aturan-hari', 'Bagian Aturan hari di halaman anak dengan pilihan Seimbang, Penuh, Ringan, dan Kustom.'),
  },
  {
    id: 'ubah-hari',
    title: 'Mengubah hari ini',
    icon: con('edit'),
    what: 'Sesi hari ini bisa diubah tanpa menyentuh aturan hari lain.',
    suits: 'Laras kelas 3 ada ulangan pecahan besok. Bundanya mengganti pelajaran Latihan Math hari ini ke pecahan, dan menjadikan Latihan Science opsional supaya malamnya tidak terlalu panjang.',
    steps: [
      <>
        Buka halaman anak, lalu <L>Sesi hari ini</L>. Sesi dibuat saat anak membuka Kira. Kalau anak belum membukanya hari ini, tekan <L>Siapkan sesi hari ini</L> supaya bisa diubah lebih dulu.
      </>,
      <>
        Tekan <L>Jadikan wajib</L> atau <L>Jadikan opsional</L> pada sebuah sesi.
      </>,
      <>
        Sesi yang belum dimulai bisa dihapus dengan <L>Hapus sesi</L>, atau diubah jumlah soalnya antara 5 dan 30 lewat <L>Jumlah soal</L>. Paper tidak bisa diubah jumlah soalnya.
      </>,
      <>
        Untuk Latihan dan Tes, tekan <L>Ganti pelajaran</L>, pilih topik, lalu <L>Pakai pelajaran ini</L>. Pilihannya mengikuti kelas dan mapel anak.
      </>,
      <>
        Perlu lebih? Pakai <L>Tambah sesi opsional</L>, sampai 10 sesi per hari.
      </>,
    ],
    control: 'Semua perubahan ini hanya untuk hari ini. Sesi yang sudah selesai tidak bisa diganti pelajarannya, dan sesi yang sudah dibuka anak tetap berjalan sampai selesai. Layar anak mengikuti perubahan saat dibuka lagi.',
  },
  {
    id: 'streak',
    title: 'Aturan streak',
    icon: ui('star'),
    tone: 'yellow',
    what: 'Streak menghitung hari lengkap yang berurutan. Hari lengkap berarti semua sesi wajib hari itu selesai. Sesi opsional tidak menambah dan tidak memutus streak.',
    suits: 'Aisha sudah 7 hari lengkap berturut-turut dan mendapat satu pembeku. Saat menginap di rumah nenek satu hari, pembeku itu terpakai dan streaknya tetap jalan.',
    steps: [
      'Semua sesi wajib selesai: streak bertambah satu.',
      'Hari istirahat, bawaannya Minggu, tidak memutus streak. Kalau anak tetap menyelesaikan sesinya, hari itu tetap dihitung.',
      'Setiap 7 hari lengkap berturut-turut memberi 1 pembeku, paling banyak 2 tersimpan.',
      'Hari yang terlewat memakai pembeku. Tanpa pembeku, streak kembali ke 0. Hari ini yang belum selesai tidak memutus streak.',
    ],
    control: (
      <>
        <L>Hari istirahat</L> dipilih di bagian <L>Batas waktu layar</L>. <L>Atur ulang streak</L> ada di <L>Pengaturan</L>: ketik nama anak untuk memulai hitungan baru. XP dan hadiah yang sudah didapat tidak berubah.
      </>
    ),
  },
  {
    id: 'bahasa',
    title: 'Bahasa di layar anak',
    icon: ui('globe'),
    tone: 'sky',
    what: 'Tombol, petunjuk, dan pesan di layar anak memakai bahasa Indonesia sebagai bawaan. Soal dan pelajaran tetap memakai bahasa aslinya, kebanyakan bahasa Inggris. Sebagian soal, seperti ESMO Math, memang berbahasa Indonesia.',
    suits: 'Dimas kelas 1 belum lancar membaca bahasa Inggris. Ia tetap paham cara memakai Kira, dan kata sulit di soal tinggal diketuk untuk melihat artinya.',
    steps: [
      <>
        Saat menambahkan anak, pilih <L>Bahasa tampilan anak</L>: <L>Bahasa Indonesia</L> atau <L>English</L>.
      </>,
      'Anak membaca tombol dan petunjuk dalam bahasa itu, lalu mengerjakan soal dalam bahasa aslinya, dengan tombol baca suara.',
      'Kata yang belum dikenal di soal English bisa diketuk untuk melihat artinya dalam bahasa Indonesia.',
    ],
    control: (
      <>
        Ganti <L>Bahasa tampilan anak</L> kapan saja di halaman anak, bagian <L>Pengaturan</L>. Kalau pilihan boleh mengganti bahasa sendiri dinyalakan, tombol bahasa muncul di halaman <L>Aku</L> milik anak. Bahasa soal tidak ikut berubah, supaya anak tetap berlatih bahasa Inggris. Nama tombol di panduan ini memakai bahasa Indonesia.
      </>
    ),
  },
]

/** Contoh dari pemilik Kira: saklar yang menyala dan yang mati. */
function SwitchExample() {
  const keep = ['Sains', 'Olimpiade Sains', 'Bahasa Inggris', 'Drill kosakata']
  return (
    <div className="flex flex-col gap-3 rounded-control border-2 border-lavender p-4">
      <p className="m-0 font-bold">Contoh: Science harian, olimpiade Science, English harian, dan drill kosakata saja, tanpa drill Math</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <p className="m-0 font-bold">Menyala</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {keep.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <UiIcon name="check" size={20} />
                {k}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          <p className="m-0 font-bold">Mati</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            <li className="flex items-center gap-2">
              <UiIcon name="close" size={20} />
              Drill Matematika
            </li>
            <li className="flex items-center gap-2">
              <UiIcon name="close" size={20} />
              Saklar lain yang tidak dipakai
            </li>
          </ul>
        </div>
      </div>
      <p className="m-0">English harian di sini mengacu pada kerangka Cambridge Primary. Kalau Math juga tidak diinginkan di layar Hari ini, matikan juga saklar Matematika.</p>
    </div>
  )
}

const SAKLAR: GuideFeature[] = [
  {
    id: 'saklar',
    title: 'Saklar mapel dan fitur',
    icon: con('settings'),
    what: 'Setiap anak punya daftar saklar sendiri. Jalur rekomendasi menyalakan Math, English, Science, drill, kartu, baca, Dunia Kira, kamus, alat peraga, dan tes penempatan. Quiz Arena dan English Skills ikut menyala mulai kelas 3, dan Paper mulai kelas 5. Olimpiade menyala hanya kalau Ayah/Bunda memilihnya. Mapel yang dimatikan hilang dari layar Hari ini dan tidak dihitung untuk streak.',
    extra: <SwitchExample />,
    suits: 'Anak yang sudah punya les Math di luar dan ingin fokus pada Science dan English, seperti contoh di atas. Pilihan ini bisa diubah kapan saja.',
    steps: [
      <>
        Buka <A href="/keluarga">Keluarga</A>, pilih anak, lalu buka <L>Pengaturan</L>.
      </>,
      <>
        Cari <L>Fitur yang dipakai</L>.
      </>,
      <>
        Pakai pilihan cepat <L>Lengkap</L>, <L>Fokus sekolah</L>, atau <L>Persiapan olimpiade</L>, atau atur saklarnya satu per satu.
      </>,
      <>
        Tekan <L>Simpan pilihan fitur</L>. Sesi hari ini yang belum dimulai ikut disesuaikan.
      </>,
    ],
    control: 'Fokus sekolah mematikan olimpiade, Quiz Arena, dan Dunia Kira. Persiapan olimpiade mematikan Quiz Arena, Dunia Kira, dan Ruang Baca. Mematikan satu mapel ikut mematikan olimpiade mapel itu, dan untuk Matematika juga drill dan hitung cepatnya.',
    shot: shot('saklar-fitur', 'Bagian Fitur yang dipakai: pilihan cepat dan daftar saklar untuk mapel, olimpiade, drill, dan fitur lain.'),
  },
]

export const SWITCHES: { title: string; items: [string, string][] }[] = [
  {
    title: 'Mapel harian',
    items: [
      ['Matematika', 'Sesi Math di layar Hari ini.'],
      ['Bahasa Inggris', 'Sesi English di layar Hari ini.'],
      ['Sains', 'Sesi Science di layar Hari ini.'],
    ],
  },
  {
    title: 'Olimpiade',
    items: [['Olimpiade Matematika, Bahasa Inggris, Sains', 'Latihan gaya lomba per mapel di Latihan bebas, Lomba, dan paket ESMO.']],
  },
  {
    title: 'Drill dan latihan',
    items: [
      ['Drill Matematika', 'Latihan bebas per topik Math.'],
      ['Hitung cepat (Mental Math)', 'Hitung Cepat: sprint, Flash Anzan, dan sempoa.'],
      ['Drill kosakata', 'Latihan kata English.'],
      ['Kartu belajar (Flashcards)', 'Kartu bolak-balik per mapel dan kelas.'],
    ],
  },
  {
    title: 'Lainnya',
    items: [
      ['Quiz Arena', 'Arena Kuis: kuis pengetahuan umum dengan 12 topik, misalnya bendera, hewan, dan tata surya.'],
      ['Ruang Baca', '18 buku cerita dan bacaan, 3 buku per kelas.'],
      ['English Skills', 'Menyimak, berbicara, menulis, Spelling Bee, dan membaca. Berbicara dan menulis perlu didengar atau dibaca orang dewasa.'],
      ['Paper', 'Sesi Paper di layar Hari ini: mini 8 soal, penuh 20 soal.'],
      ['Dunia Kira', 'Bintang, toko, teman, album, cerita, bos, dan ruang trofi.'],
      ['Kamus', 'Kata yang bisa diketuk dan daftar Kata-kataku.'],
      ['Alat peraga', 'Layar Alat peraga dan soal yang memakai alat peraga.'],
      ['Tes penempatan', 'Tes titik mulai per mapel.'],
    ],
  },
]

const LATIHAN: GuideFeature[] = [
  {
    id: 'practice',
    title: 'Latihan bebas',
    icon: ui('list'),
    what: 'Tempat latihan di luar sesi harian. Anak memilih jumlah soal (5, 8, 10, atau 15), memakai waktu atau tidak, jenis soal, dan topik. Latihan di sini memberi XP dan tidak memengaruhi streak.',
    suits: 'Raka kelas 4 sudah selesai sesi harian dan ingin menambah soal cerita Math. Ia memilih 8 soal, tanpa waktu, jenis Soal cerita.',
    steps: [
      <>
        Anak membuka <L>Latihan</L> dari menu.
      </>,
      'Anak memilih jumlah soal, waktu, dan jenis soal.',
      <>
        Anak memilih satu kartu topik, misalnya di bagian <L>Latihan Matematika</L>, <L>Olimpiade</L>, atau <L>Kartu dan kata</L>.
      </>,
      'Soal berjalan seperti Latihan biasa, lalu kembali ke halaman yang sama.',
    ],
    control: (
      <>
        Kartu di halaman ini mengikuti <A href="#saklar">saklar fitur</A>. Bagian yang dimatikan tidak muncul.
      </>
    ),
    shot: shot('latihan', 'Layar Latihan bebas: pilihan jumlah soal, waktu, jenis soal, dan kartu topik.'),
  },
  {
    id: 'hitung-cepat',
    title: 'Hitung cepat',
    icon: ui('bolt'),
    what: 'Hitung Cepat melatih hitungan di kepala. Ada misi harian sekitar 5 menit, Sprint 60 detik dan 2 menit, Target 20 soal, tabel perkalian 2 sampai 12, Flash Anzan, dan sempoa. Ada juga 7 pelajaran strategi.',
    suits: 'Tio kelas 2 masih menghitung dengan jari untuk penjumlahan sederhana. Lima menit misi harian melatihnya setiap hari, dan ia bisa melihat kecepatannya sendiri di bagian statistik.',
    steps: [
      <>
        Anak membuka <L>Hitung Cepat</L>, lalu menekan <L>Mulai misi</L>.
      </>,
      'Empat langkah berjalan berurutan: pemanasan, Sprint 60, Flash Anzan, dan tabel perkalian.',
      <>
        Di luar misi, anak boleh memilih sendiri dari <L>Pilih permainan</L>.
      </>,
    ],
    control: (
      <>
        Saklar <L>Hitung cepat (Mental Math)</L>. Ayah/Bunda bisa melihat ringkasannya di halaman anak, bagian <L>Quick Maths dan Quiz</L>. Permainan ini bersifat pilihan dan tidak memengaruhi streak.
      </>
    ),
    shot: shot('hitung-cepat', 'Layar Hitung Cepat: level anak dan empat langkah misi harian.'),
  },
  {
    id: 'drill-math',
    title: 'Drill Math',
    icon: ui('plus'),
    tone: 'sky',
    what: 'Latihan per topik Math sesuai kelas anak, dari halaman Latihan bebas. Satu kartu untuk satu bagian Math, misalnya bilangan atau pecahan.',
    suits: 'Laras kelas 3 sedang belajar pecahan di sekolah. Ia memilih kartu bagian itu dan mengerjakan 10 soal tambahan tanpa mengubah sesi hariannya.',
    steps: [
      <>
        Buka <L>Latihan</L>, lalu bagian <L>Latihan Matematika</L>.
      </>,
      'Pilih satu topik.',
      'Kerjakan 5 sampai 15 soal. Kira menghindari soal yang baru saja keluar.',
    ],
    control: (
      <>
        Saklar <L>Drill Matematika</L>. Sesi Math harian tetap jalan walaupun saklar ini dimatikan.
      </>
    ),
  },
  {
    id: 'olimpiade',
    title: 'Drill olimpiade per bagian',
    short: 'Olimpiade',
    icon: ui('trophy'),
    tone: 'yellow',
    what: 'Soal olimpiade buatan Kira dengan gaya lomba, per mapel. Di Latihan bebas ada drill per topik dan paket gaya lomba tertentu. Di layar Lomba ada simulasi hari lomba: tanpa petunjuk dan waktunya terus berjalan. Keluarga baru tidak menerima paper resmi lomba.',
    suits: 'Tio kelas 2 ingin ikut lomba Math di sekolah. Ia berlatih per topik dulu, lalu mencoba simulasi IKMC Pre-Ecolier: 24 soal dalam 75 menit.',
    steps: [
      <>
        Untuk drill, buka <L>Latihan</L>, bagian <L>Olimpiade</L>, lalu pilih topik atau paket.
      </>,
      <>
        Untuk simulasi, buka <L>Lomba</L>, pilih kartu lomba, lalu tekan <L>Mulai latihan</L>.
      </>,
      <>
        Jawaban yang salah di simulasi masuk ke <L>Perbaiki</L> untuk diulang.
      </>,
    ],
    control: (
      <>
        Saklar <L>Olimpiade Matematika</L>, <L>Olimpiade Bahasa Inggris</L>, dan <L>Olimpiade Sains</L> terpisah, dan menyala hanya atas pilihan Ayah/Bunda. Saat ini simulasi lomba tersedia untuk kelas 1 sampai 3 dan kelas 5 sampai 6, belum untuk kelas 4. Kartu bertanda <L>Aturan belum diperiksa</L> berarti formatnya belum dicocokkan dengan aturan lomba.
      </>
    ),
    shot: shot('lomba', 'Layar Lomba: kartu simulasi dengan jumlah soal dan waktu.'),
  },
  {
    id: 'kartu',
    title: 'Kartu belajar',
    icon: ui('cards'),
    what: 'Kartu bolak-balik untuk Math, English, dan Science, kelas 1 sampai 6. Ada 295 dek, kebanyakan berisi 19 sampai 25 kartu. Satu ronde berisi 10 kartu, dan kartu yang sudah waktunya diulang muncul lebih dulu.',
    suits: 'Nadia kelas 6 mau mengulang istilah Science menjelang ulangan. Sepuluh kartu cukup untuk waktu menunggu jemputan.',
    steps: [
      <>
        Buka <L>Latihan</L>, lalu <L>Kartu belajar</L>.
      </>,
      'Pilih dek. Dek kelas anak muncul lebih dulu.',
      <>
        Ketuk kartu untuk membalik, lalu tekan <L>Aku tahu</L> atau <L>Belum tepat</L>.
      </>,
    ],
    control: (
      <>
        Saklar <L>Kartu belajar (Flashcards)</L>. Kartu memberi XP dengan batas harian dan tidak memengaruhi streak.
      </>
    ),
    shot: shot('kartu', 'Layar Kartu belajar: daftar dek per mapel dengan jumlah kartu yang sudah dikuasai.'),
  },
  {
    id: 'kosakata',
    title: 'Drill kosakata',
    icon: ui('pencil'),
    what: 'Latihan kata English dengan tiga jenis: kata ke arti, arti ke kata, dan mengeja. Kata yang disimpan anak dari kamus terkumpul di Kata-kataku dan menjadi dek pribadi.',
    suits: 'Aisha kelas 2 sering menemukan kata baru saat membaca. Ia menyimpannya, lalu berlatih dengan dek Kata-kataku di akhir minggu.',
    steps: [
      <>
        Buka <L>Latihan</L>, bagian <L>Kartu dan kata</L>, lalu <L>Latihan kosakata</L>.
      </>,
      'Pilih dek English.',
      'Jawab dengan salah satu dari tiga jenis latihan.',
    ],
    control: (
      <>
        Saklar <L>Drill kosakata</L>. Dek Kata-kataku ikut saklar <L>Kamus</L>. Anak bisa menyimpan sampai 500 kata.
      </>
    ),
  },
  {
    id: 'ulas-pelajaran',
    title: 'Ulasan pelajaran singkat',
    short: 'Ulasan pelajaran',
    icon: ui('book'),
    what: 'Ringkasan pelajaran untuk disegarkan dalam satu atau dua menit. Isinya sampai 4 langkah inti, lalu 3 soal kalau anak mau. Saat anak dua kali salah di Latihan, pelajaran singkat yang sama bisa dibuka dari layar soal.',
    suits: 'Raka kelas 4 lupa cara membaca grafik batang yang dipelajari minggu lalu. Ia membuka ulasannya sebelum mengerjakan soal lagi.',
    steps: [
      <>
        Buka <L>Latihan</L>, lalu <L>Pelajaran yang selesai</L>.
      </>,
      'Pilih pelajaran yang sudah selesai.',
      <>
        Baca langkahnya, lalu tekan <L>Coba 3 soal</L> atau <L>Buka pelajaran lengkap</L>.
      </>,
    ],
    control: 'Daftar ini berisi pelajaran yang sudah diselesaikan anak di Peta, jadi masih kosong di hari-hari pertama. Tidak ada batas pemakaian, dan streak tidak berubah. Mapel yang dimatikan tidak muncul.',
  },
  {
    id: 'penempatan',
    title: 'Tes penempatan',
    icon: ui('map'),
    tone: 'sky',
    what: 'Tes singkat untuk menemukan titik mulai per mapel: 8 sampai 12 soal yang menyesuaikan jawaban anak, sekitar 5 menit per mapel. Tanpa waktu, tanpa skor untuk anak, dan tanpa XP. Hasilnya menentukan soal pertama yang diberikan.',
    suits: 'Bima pindah dari sekolah lain dan masuk kelas 5. Tes menunjukkan bagian yang sudah kuat dan bagian yang perlu dimulai dari lebih bawah.',
    steps: [
      <>
        Anak baru melihat kartu <L>Temukan titik mulaimu</L> di layar Hari ini.
      </>,
      <>
        Anak mengerjakan tes satu mapel, atau menekan <L>Nanti saja</L>.
      </>,
      <>
        Ayah/Bunda membaca peta kekuatan di halaman anak, bagian <L>Tes penempatan</L>.
      </>,
    ],
    control: (
      <>
        Tes bisa disiapkan lagi lewat tombol <L>Siapkan tes</L>, sekali per 30 hari. Saklar <L>Tes penempatan</L> mematikannya.
      </>
    ),
  },
]

const ALAT: GuideFeature[] = [
  {
    id: 'kamus',
    title: 'Kamus ketuk',
    icon: ui('search'),
    what: 'Kata bergaris titik di soal, pelajaran, dan Ruang baca bisa diketuk. Muncul arti bahasa Indonesia, penjelasan English sederhana, dan tombol suara. Kamusnya berisi hampir 5.000 kata.',
    suits: 'Dimas kelas 1 bertemu kata "kite" dalam soal. Ia mengetuknya, melihat arti layang-layang, mendengar cara bacanya, lalu lanjut sendiri tanpa memanggil orang tua.',
    steps: [
      'Anak mengetuk kata yang bergaris titik.',
      'Arti dan tombol suara muncul di layar.',
      <>
        Anak menekan <L>Simpan</L> kalau ingin menyimpannya ke <L>Kata-kataku</L>.
      </>,
    ],
    control: (
      <>
        Saklar <L>Kamus</L>. Kata tidak bisa diketuk pada soal mengeja, soal mendengarkan, dan soal yang menguji arti kata, supaya jawabannya tidak terbuka.
      </>
    ),
    shot: shot('kamus', 'Kata pada pelajaran yang diketuk: arti bahasa Indonesia, penjelasan English, dan tombol simpan.'),
  },
  {
    id: 'penjelasan',
    title: 'Penjelasan bergerak',
    icon: ui('play'),
    what: 'Pembahasan soal langkah demi langkah dengan suara, 2 sampai 8 langkah. Gambar bergerak ada di Math. Sebagian soal Science punya langkah pembahasan juga. Anak mengatur sendiri lewat tombol putar, jeda, dan langkah.',
    suits: (
      <>
        Aisha salah dua kali di soal pengurangan. Ia menekan <L>Lihat caranya</L>, mengikuti langkahnya, lalu mencoba <L>Coba soal serupa</L>.
      </>
    ),
    steps: [
      <>
        Setelah jawaban dibuka, anak menekan <L>Lihat caranya</L>.
      </>,
      'Anak menekan putar, atau maju per langkah.',
      <>
        Anak bisa lanjut ke <L>Buka pelajaran singkat</L> atau <L>Coba soal serupa</L>.
      </>,
    ],
    control: 'Bagian ini tidak punya saklar sendiri. Penjelasan tidak muncul selama Tes dan Paper berjalan, hanya sesudah dikumpulkan. Perangkat yang mengurangi gerak menampilkan gambar diam dengan tombol langkah.',
  },
  {
    id: 'ruang-baca',
    title: 'Ruang baca',
    icon: ui('book'),
    tone: 'yellow',
    what: 'Perpustakaan 18 buku English, 3 buku per kelas, total 84 bab. Teks bisa diperbesar, dan kalimat bisa dibacakan dengan suara English perangkat. Setiap bab punya kuis 5 soal.',
    suits: 'Nadia kelas 6 suka cerita tapi jarang membaca dalam bahasa Inggris. Ia membaca satu bab sebelum tidur, mengetuk kata yang belum dikenal, lalu mengerjakan kuisnya.',
    steps: [
      <>
        Anak membuka <L>Ruang baca</L>, lalu memilih buku berdasarkan level atau jenis.
      </>,
      <>
        Anak membaca sendiri atau menekan <L>Baca bersama</L>.
      </>,
      'Di akhir bab ada kuis 5 soal, memberi XP dan bintang.',
    ],
    control: (
      <>
        Saklar <L>Ruang Baca</L>. Waktu membaca dan buku yang selesai terlihat di layar yang sama.
      </>
    ),
    shot: shot('baca', 'Layar Ruang baca: waktu membaca dan pilihan buku per kelas.'),
  },
  {
    id: 'alat-peraga',
    title: 'Alat peraga Math',
    short: 'Alat peraga',
    icon: ui('zoom-in'),
    tone: 'sky',
    what: 'Lima alat untuk bermain bebas tanpa nilai: balok nilai tempat, batang pecahan, model batang, tangram, dan papan paku. Semuanya dipakai dengan mengetuk.',
    suits: 'Tio kelas 2 belum paham puluhan. Ia menukar 10 balok satuan menjadi 1 balok puluhan sampai polanya terasa masuk akal.',
    steps: [
      <>
        Anak membuka <L>Alat peraga</L> dari menu.
      </>,
      'Anak memilih alat dan mencoba-coba sendiri.',
      'Alat yang sama juga muncul di beberapa soal Math dan langkah pelajaran. Di luar itu, alat tidak bisa dibuka di tengah soal.',
    ],
    control: (
      <>
        Saklar <L>Alat peraga</L>. Saat dimatikan, soal yang memakai alat peraga juga tidak diberikan.
      </>
    ),
    shot: shot('alat', 'Layar Alat peraga: lima alat, dengan balok nilai tempat terbuka.'),
  },
]

const DUNIA: GuideFeature[] = [
  {
    id: 'bintang',
    title: 'Dompet bintang',
    icon: ui('star'),
    tone: 'yellow',
    what: 'Bintang didapat dari belajar. Sesi wajib memberi 3 bintang, tambah 2 kalau sempurna. Bab Ruang baca dan latihan Hitung Cepat atau Arena Kuis memberi bintang sampai 3 kali per hari. Bintang tidak kedaluwarsa, tidak berkurang saat anak libur, dan tidak bisa dibeli dengan uang.',
    suits: 'Aisha kelas 2 lebih semangat kalau usahanya terlihat. Dengan 3 sesi wajib ia mendapat 9 sampai 15 bintang sehari.',
    steps: [
      'Anak menyelesaikan sesi. Bintang masuk dompet dan terlihat di halaman hasil.',
      'Mengulang sesi yang sama tidak memberi bintang lagi.',
      'Anak membelanjakan bintang di toko atau untuk temannya.',
    ],
    control: (
      <>
        Saklar <L>Dunia Kira</L> mematikan layar toko, teman, album, cerita, bos, dan ruang trofi. Bintang di akhir sesi (1 sampai 3) adalah nilai sesi. Bintang dompet dihitung terpisah.
      </>
    ),
    shot: shot('dunia', 'Beranda Dunia Kira: jumlah bintang, telur teman, dan pintu ke toko, album, serta cerita.'),
  },
  {
    id: 'toko',
    title: 'Toko Bintang',
    icon: ui('gift'),
    what: 'Toko berisi 15 barang hiasan seharga 8 sampai 150 bintang: kostum teman, rumah, pakaian avatar, bingkai, dan latar. Ada yang bisa dibeli di hari pertama, ada yang jadi tujuan berminggu-minggu. Harganya tetap dan tidak ada hitungan mundur.',
    suits: 'Raka kelas 4 ingin mahkota kecil untuk temannya, seharga 60 bintang. Itu sekitar seminggu belajar, jadi ia punya tujuan yang terasa bisa dicapai.',
    steps: [
      <>
        Buka <L>Dunia Kira</L>, lalu <L>Toko Bintang</L>.
      </>,
      'Pilih barang dan bayar dengan bintang.',
      <>
        Tekan <L>Pakai</L> untuk memakainya, atau <L>Tempati</L> untuk rumah.
      </>,
    ],
    control: 'Barangnya hanya hiasan dan tidak memengaruhi soal atau nilai. Tidak ada pembelian dengan uang sungguhan.',
    shot: shot('toko', 'Layar Toko Bintang: rumah dan kostum teman dengan harga bintang.'),
  },
  {
    id: 'teman',
    title: 'Teman (pet)',
    icon: ui('person'),
    what: 'Setiap anak punya telur misteri yang menetas setelah mengumpulkan 5 bintang. Anak memilih satu dari 6 teman dan memberinya nama. Teman tumbuh setelah 10 sesi wajib, lalu tumbuh lagi setelah 40 sesi wajib.',
    suits: 'Tio kelas 2 sering lupa belajar kalau tidak diingatkan. Ia ingin melihat temannya tumbuh, dan libur beberapa hari tidak membuat temannya kenapa-kenapa.',
    steps: [
      <>
        Buka <L>Dunia Kira</L>, lalu <L>Teman</L>, dan tekan <L>Tetaskan telur</L>.
      </>,
      'Pilih teman dan beri nama. Keduanya tidak bisa diganti setelah itu.',
      'Beri camilan atau mainan seharga 2 sampai 5 bintang kalau mau. Teman membalas dengan kalimat ceria dan hati bertambah.',
    ],
    control: 'Teman tidak pernah sakit dan tidak pergi. Tidak ada yang berkurang saat anak libur, dan camilan selalu pilihan.',
  },
  {
    id: 'album',
    title: 'Album kartu',
    icon: ui('cards'),
    tone: 'sky',
    what: 'Album berisi 121 kartu dalam 14 set. Kartu didapat dari kemajuan belajar: fakta di Arena Kuis, skill yang dikuasai, bos yang dikalahkan, bab cerita, buku yang selesai, dan tonggak seperti streak terbaik. Tidak ada undian dan tidak ada kartu kembar. Satu set lengkap memberi hadiah hiasan gratis.',
    suits: 'Nadia kelas 6 suka mengoleksi. Ia tahu persis syarat tiap kartu, misalnya mengenal 35 persen fakta hewan, jadi ia punya tujuan yang jelas.',
    steps: [
      <>
        Buka <L>Dunia Kira</L>, lalu <L>Album kartu</L>.
      </>,
      'Setiap kartu yang belum didapat menunjukkan syaratnya.',
      'Kartu masuk album begitu syaratnya terpenuhi.',
    ],
    control: (
      <>
        Ikut saklar <L>Dunia Kira</L>. Kartu yang syaratnya bergantung pada fitur yang dimatikan tidak ditampilkan.
      </>
    ),
    shot: shot('album', 'Layar Album kartu: kartu yang sudah didapat dan syarat kartu berikutnya.'),
  },
  {
    id: 'cerita',
    title: 'Cerita mingguan',
    icon: ui('book'),
    tone: 'yellow',
    what: 'Cerita bergambar dengan suara, "Kira and the Lost Library", 8 bab. Bab pertama langsung terbuka. Bab berikutnya terbuka untuk setiap minggu dengan minimal 4 hari sesi wajib selesai. Tidak perlu bintang.',
    suits: 'Laras kelas 3 lebih mudah diajak belajar rutin kalau ada lanjutan cerita yang ditunggu tiap minggu.',
    steps: [
      <>
        Buka <L>Dunia Kira</L>, lalu <L>Cerita mingguan</L>.
      </>,
      'Baca bab yang terbuka, atau dengarkan suaranya.',
      'Selesaikan sesi wajib 4 hari dalam seminggu. Bab berikutnya terbuka.',
    ],
    control: 'Hari istirahat tidak dihitung, jadi anak tidak dirugikan. Bab yang sudah terbuka tetap terbuka.',
    shot: shot('cerita', 'Layar Cerita mingguan: bab pertama terbuka dan bab berikutnya menunggu target mingguan.'),
  },
  {
    id: 'bos',
    title: 'Tantangan bos',
    icon: ui('bolt'),
    what: 'Ada 14 lawan ramah dalam 3 level, mulai dari Puzzle Robot. Satu tantangan berisi 10 soal biasa sesuai kelas anak, dan anak menang kalau benar 7. Lawan baru datang setiap 2 hari belajar. Kemenangan pertama dalam seminggu memberi 10 bintang, dan kemenangan pertama atas seorang lawan memberi kartunya.',
    suits: 'Raka kelas 4 suka tantangan. Ia memilih lawan yang kelemahannya Math, dan kalah pun ia hanya perlu mencoba lagi.',
    steps: [
      <>
        Buka <L>Dunia Kira</L>, lalu pilih tantangan bos.
      </>,
      'Pilih lawan yang sudah datang. Setiap lawan menunjukkan kelemahannya, misalnya hitungan atau kosakata.',
      'Jawab 10 soal. Setiap jawaban benar menguras tenaga lawan.',
      'Menang atau belum, hasilnya tampil dan anak boleh mencoba lagi.',
    ],
    control: 'Tidak ada yang hilang saat kalah, anak tidak punya nyawa, dan main lagi tidak memakai bintang. Lawan dari mapel yang dimatikan tidak diberikan.',
    shot: shot('bos', 'Layar tantangan bos: avatar anak berhadapan dengan lawan, dengan aturan menang.'),
  },
  {
    id: 'piala',
    title: 'Ruang trofi',
    icon: ui('trophy'),
    tone: 'yellow',
    what: 'Satu tempat untuk semua pencapaian: lencana, bos yang dikalahkan, set kartu lengkap, sertifikat streak 7, 30, dan 100 hari dalam PDF, serta medali lomba sungguhan.',
    suits: 'Bima kelas 5 baru mendapat medali perak di lomba sekolah. Ayahnya mencatatnya, dan medali itu tampil di ruang trofi Bima.',
    steps: [
      <>
        Anak membuka <L>Dunia Kira</L>, lalu <L>Ruang trofi</L>.
      </>,
      <>
        Ayah/Bunda mencatat medali di halaman <L>Medali lomba anak</L>: nama lomba, jenis medali, dan tanggal.
      </>,
    ],
    control: 'Hanya orang tua yang bisa menambah dan menghapus medali. Pilihannya emas, perak, perunggu, penghargaan khusus, dan peserta.',
    shot: shot('piala', 'Layar Ruang trofi: sertifikat streak dan lencana.'),
  },
]

const ORTU: GuideFeature[] = [
  {
    id: 'pelatih',
    title: 'Pelatih orang tua',
    icon: con('sparkle'),
    what: 'Tiga hal kecil untuk dilakukan di rumah minggu ini, dipilih dari data belajar anak, tanpa AI. Pelatih memilih sampai 3 skill yang paling perlu dilatih, lalu memberi kegiatan, pertanyaan untuk anak, dan kalimat pujian yang bisa diucapkan.',
    suits: 'Ayah Tio tidak tahu harus mulai dari mana untuk membantu Math. Pelatih menyarankan kegiatan "Hitung dan loncat di dapur", lengkap dengan barang yang perlu disiapkan.',
    steps: [
      <>
        Buka <A href="/keluarga/pelatih">Pelatih</A> di menu keluarga, lalu pilih anak.
      </>,
      'Baca kegiatan minggu ini dan coba satu saja.',
      <>
        Pakai bagian <L>Yang patut dipuji</L> dan <L>Kalimat yang bisa Anda ucapkan</L>.
      </>,
    ],
    control: 'Sebuah skill baru dipilih setelah anak menjawab minimal 10 soal di skill itu. Sebelum itu tampil keterangan Belum cukup data dan kegiatan awal yang ringan. Kegiatan berganti setiap minggu.',
    shot: shot('pelatih', 'Halaman Pelatih orang tua: skill yang perlu dilatih dan penjelasannya.'),
  },
  {
    id: 'laporan',
    title: 'Laporan dan mencetak',
    short: 'Laporan dan cetak',
    icon: con('printer'),
    what: 'Tiga bentuk laporan. Minggu ini merangkum waktu belajar, yang sudah lancar, dan yang perlu diulang. Rapor bulanan bisa dicetak atau disimpan sebagai PDF, termasuk cakupan yang mengacu pada kerangka Cambridge Primary. Lembar kerja membuat soal cetak dengan kunci jawaban.',
    suits: 'Bunda Rina ingin bahan latihan tanpa layar di akhir pekan. Ia membuat lembar kerja pendek 6 soal untuk Aisha, mencetaknya, dan memeriksa dengan kuncinya.',
    steps: [
      <>
        Buka <A href="/keluarga/minggu">Minggu ini</A> untuk ringkasan minggu berjalan.
      </>,
      <>
        Buka <A href="/keluarga/rapor">Rapor</A>, pilih bulan (6 bulan terakhir), lalu cetak atau simpan sebagai PDF.
      </>,
      <>
        Buka <A href="/keluarga/lembar">Lembar kerja</A>, pilih skill dan panjang (6, 10, atau 15 soal), lalu tekan <L>Buat lembar kerja</L>.
      </>,
      <>
        Tekan <L>Buka lembar untuk anak</L> dan <L>Buka kunci jawaban</L>, lalu cetak lewat browser.
      </>,
    ],
    control: (
      <>
        Email laporan mingguan dikirim Minggu pukul 19.00 WIB kalau izin <L>Laporan mingguan lewat email</L> menyala. Lembar kerja dibatasi 10 lembar per keluarga per hari.
      </>
    ),
    shot: shot('rapor', 'Halaman Rapor bulanan: pilihan anak dan bulan, dengan waktu belajar dan hari belajar.'),
  },
  {
    id: 'batas-layar',
    title: 'Batas waktu layar',
    icon: ui('clock'),
    what: 'Setiap anak punya batas waktu per hari, bawaannya 60 menit. Saat batas tercapai, anak diajak istirahat dan sesi baru tidak bisa dimulai. Jawaban yang sudah masuk tetap tersimpan.',
    suits: 'Dimas kelas 1 dibatasi 30 menit di hari sekolah oleh ayahnya, supaya masih ada waktu bermain di luar.',
    steps: [
      <>
        Buka halaman anak, lalu <L>Pengaturan</L>, lalu <L>Batas waktu layar</L>.
      </>,
      <>
        Isi <L>Paling lama per hari (menit)</L>, antara 15 dan 180, dan pilih <L>Hari istirahat</L>.
      </>,
      <>
        Tekan <L>Simpan batas</L>.
      </>,
    ],
    control: (
      <>
        Anak melihat pesan <L>Waktunya istirahat</L>. Ronde yang sedang berjalan tidak dipotong. Hitungan mulai dari nol lagi pukul 00.00 WIB.
      </>
    ),
  },
]

const DATA: GuideFeature[] = [
  {
    id: 'privasi',
    title: 'Data dan privasi',
    icon: con('shield'),
    what: 'Kira menyimpan nama panggilan, kelas, avatar, PIN dalam bentuk acak satu arah, jawaban, skor, dan waktu belajar, di server pengelola di Indonesia, dengan cadangan harian. Akun orang tua menyimpan nama, email, dan password dalam bentuk acak satu arah. Tidak ada iklan, tidak ada analitik, dan anak tidak punya profil publik atau kolom obrolan. Lalu lintas lewat Cloudflare. AI dimatikan selama beta.',
    suits: 'Ayah Bima ingin tahu persis apa yang tercatat tentang anaknya. Ia mengunduh salinan data Bima dan membaca riwayat persetujuannya.',
    steps: [
      <>
        Buka <A href="/keluarga/privasi">Privasi</A> di menu keluarga, lalu pilih anak.
      </>,
      'Nyalakan atau matikan izin per tujuan. Setiap perubahan tercatat di riwayat.',
      <>
        Tekan <L>Unduh data (JSON)</L> untuk menyimpan salinan.
      </>,
    ],
    control: (
      <>
        Izin utama ada empat: <L>Belajar di Kira</L>, <L>Laporan mingguan lewat email</L>, <L>Rekaman suara</L>, dan <L>Foto dan gambar jawaban</L>. Tidak ada yang tercentang dari awal. Rekaman dan foto disimpan 90 hari. Rincian lengkapnya ada di <A href="/privasi">Kebijakan Privasi</A>.
      </>
    ),
    shot: shot('privasi', 'Halaman Privasi keluarga: sakelar izin per tujuan dengan penjelasan dan tanggal.'),
  },
  {
    id: 'hapus',
    title: 'Menghapus data',
    icon: con('trash'),
    what: 'Akun dan data seorang anak bisa dihapus sendiri kapan saja. Anak langsung tidak bisa masuk, lalu datanya dihapus permanen setelah 7 hari. Selama 7 hari itu penghapusan masih bisa dibatalkan.',
    suits: 'Keluarga Laras berhenti memakai Kira di akhir semester. Bundanya mengunduh salinan data dulu, lalu menghapus akun Laras.',
    steps: [
      <>
        Buka <A href="/keluarga/privasi">Privasi</A>, lalu pilih anak.
      </>,
      <>
        Tekan <L>Hapus akun</L> dengan nama anak, lalu ketik nama anak untuk memastikan.
      </>,
      <>
        Tekan <L>Hapus akun dan data</L>. Email konfirmasi dikirim ke Ayah/Bunda.
      </>,
      <>
        Berubah pikiran dalam 7 hari? Tekan <L>Batalkan penghapusan</L>.
      </>,
    ],
    control: (
      <>
        Setelah 7 hari data tidak bisa dikembalikan. Catatan audit disimpan 12 bulan, dan cadangan server hilang paling lama 8 minggu kemudian. Untuk menghapus akun orang tua, kirim permintaan lewat <A href="#bantuan">Hubungi kami</A>.
      </>
    ),
  },
]

export const GROUPS: Group[] = [
  { id: 'akun', title: 'Akun dan kursi', intro: 'Dari mendaftar sampai kursi beta menjadi milik keluarga.', features: AKUN },
  { id: 'hari', title: 'Hari belajar', intro: 'Yang dilihat anak setiap hari, dan yang bisa diubah Ayah/Bunda.', features: HARI },
  { id: 'saklar', title: 'Memilih mapel dan fitur', intro: 'Kira bisa dibuat sesederhana yang dibutuhkan anak.', features: SAKLAR },
  { id: 'latihan', title: 'Latihan tambahan', intro: 'Di luar sesi harian, untuk anak yang ingin lanjut atau perlu fokus di satu hal.', features: LATIHAN },
  { id: 'alat', title: 'Alat bantu belajar', intro: 'Bantuan yang bisa dipakai anak sendiri, tanpa menunggu orang dewasa.', features: ALAT },
  { id: 'dunia', title: 'Dunia Kira', intro: 'Dunia kecil yang isinya didapat dari belajar. Tanpa uang sungguhan, undian, atau hukuman saat libur.', features: DUNIA },
  { id: 'ortu', title: 'Untuk Ayah/Bunda', intro: 'Laporan dan pengaturan yang hanya bisa dibuka dari akun orang tua.', features: ORTU },
  { id: 'data', title: 'Data anak', features: DATA },
]

export const FAQ: { id: 'cambridge' | 'data' | 'ai' | 'biaya' | 'setelah-beta' | 'dua-anak' | 'kursi-penuh'; q: string; a: ReactNode }[] = [
  {
    id: 'cambridge',
    q: 'Apakah Kira produk resmi Cambridge?',
    a: (
      <>
        <p className="m-0">Tidak. Kira tidak diselenggarakan, disahkan, atau didukung oleh Cambridge. Materi Kira mengacu pada kerangka Cambridge Primary.</p>
        <p className="m-0">Rapor bulanan menunjukkan cakupan per anak. Laporan pemetaan lengkapnya belum tersedia untuk publik.</p>
      </>
    ),
  },
  {
    id: 'data',
    q: 'Data apa yang disimpan?',
    a: (
      <>
        <p className="m-0">Untuk anak: nama panggilan, kelas, avatar, PIN dalam bentuk acak satu arah, jawaban, skor, waktu belajar, serta rekaman suara dan foto jawaban kalau izinnya diberikan.</p>
        <p className="m-0">
          Untuk orang tua: nama, email, dan password dalam bentuk acak satu arah. Data anak bisa diunduh dan dihapus dari halaman Privasi. Rinciannya ada di <A href="/privasi">Kebijakan Privasi</A>.
        </p>
      </>
    ),
  },
  {
    id: 'ai',
    q: 'Apakah AI dipakai pada data anak saya?',
    a: <p className="m-0">Tidak. AI dimatikan selama beta, jadi tidak ada data anak yang dikirim ke layanan AI. Pelatih orang tua dan pilihan soal memakai aturan tetap dari data belajar anak.</p>,
  },
  {
    id: 'biaya',
    q: 'Apakah ada biaya selama beta?',
    a: <p className="m-0">Tidak. Selama beta Kira tidak memungut biaya dan tidak memuat iklan.</p>,
  },
  {
    id: 'setelah-beta',
    q: 'Apa yang terjadi setelah beta?',
    a: <p className="m-0">Belum diputuskan. Kalau ada perubahan, setiap keluarga diberi tahu lebih dulu lewat email.</p>,
  },
  {
    id: 'dua-anak',
    q: 'Bisakah dua anak memakai satu akun?',
    a: (
      <>
        <p className="m-0">Bisa. Satu akun orang tua memuat sampai 5 anak, dan semuanya memakai satu kursi. Setiap anak punya profil, PIN, streak, dan bintang sendiri, dan boleh memakai tablet yang sama.</p>
        <p className="m-0">Setiap anak sebaiknya masuk dengan profilnya sendiri, karena soal berikutnya dipilih dari jawaban anak itu.</p>
      </>
    ),
  },
  {
    id: 'kursi-penuh',
    q: 'Bagaimana kalau kursi sudah penuh?',
    a: (
      <p className="m-0">
        Tulis email di daftar tunggu pada <A href="/">halaman depan</A>. Saat kursi dibuka lagi, email dikirim menurut urutan pendaftaran. Caranya ada di bagian <A href="#kursi">Kursi dan daftar tunggu</A>.
      </p>
    ),
  },
]
