import { Avatar, EggArt, Icon, PetArt, PetCostumeThumb, RobotArt } from '@kira/figures'
import type { ReactNode } from 'react'
import { SubjectIcon } from '@/components/learner/SubjectIcon'
import { UiIcon } from '@/components/ui/icons'
import { KiraStar } from '@/components/ui/KiraStar'
import { cx } from '@/components/ui/cx'
import { GuideFrame } from './GuideFrame'
import { TONE_BG, type Tone } from './parts'

type Stop = {
  id: string
  /** Satu kata di menu gambar. */
  menu: string
  title: string
  tone: Tone
  /** Gambar kecil di menu. */
  thumb: ReactNode
  /** Gambar besar di bagian. */
  art: ReactNode
  /** Satu kalimat pendek per baris, enak dibacakan keras-keras. */
  lines: string[]
}

function Bubble({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center justify-center rounded-control bg-surface px-3 py-1 font-display text-h3 font-semibold shadow-soft', className)}>{children}</span>
}

function Stars({ count, size = 32 }: { count: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: count }, (_, i) => (
        <KiraStar key={i} size={size} animate={false} />
      ))}
    </span>
  )
}

const STOPS: Stop[] = [
  {
    id: 'mulai',
    menu: 'Mulai',
    title: 'Cara mulai',
    tone: 'sky',
    thumb: <Avatar name="fox" size={56} />,
    art: (
      <span className="flex flex-col items-center gap-3">
        <Avatar name="fox" size={112} />
        <span className="flex items-center gap-2 rounded-control bg-surface p-2 shadow-soft">
          <Icon name="sun" size={44} />
          <Icon name="moon" size={44} />
          <Icon name="star" size={44} />
          <Icon name="cat" size={44} />
        </span>
      </span>
    ),
    lines: ['Buka Kira.', 'Ketuk gambar dan namamu.', 'Ketuk empat gambar PIN-mu. Urut, ya.', 'Sudah! Kamu masuk.', 'Lupa PIN? Tidak apa-apa. Ayah atau Bunda bisa membuat PIN baru.'],
  },
  {
    id: 'hari-ini',
    menu: 'Hari ini',
    title: 'Sesi hari ini',
    tone: 'lavender',
    thumb: <SubjectIcon subject="math" size={56} />,
    art: (
      <span className="flex items-center gap-2">
        {(
          [
            ['math', 'Math'],
            ['english', 'English'],
            ['science', 'Science'],
          ] as const
        ).map(([subject, name]) => (
          <span key={subject} className="flex flex-col items-center gap-1 rounded-control bg-surface p-2 font-display font-semibold shadow-soft">
            <SubjectIcon subject={subject} size={56} />
            {name}
          </span>
        ))}
      </span>
    ),
    lines: ['Buka halaman Hari ini.', 'Di sana ada sesimu.', 'Satu sesi berisi beberapa soal.', 'Kerjakan satu per satu.', 'Semua selesai? Ada peti hadiah untukmu!'],
  },
  {
    id: 'salah',
    menu: 'Salah? Boleh!',
    title: 'Salah itu boleh',
    tone: 'yellow',
    thumb: <UiIcon name="not-yet" size={48} />,
    art: (
      <span className="flex flex-col items-center gap-3">
        <KiraStar size={128} mood="calm" />
        <Bubble>Belum tepat</Bubble>
      </span>
    ),
    lines: ['Jawabanmu salah? Tidak apa-apa.', 'Kira tidak marah.', 'Semua orang pernah salah saat belajar.', 'Coba lagi. Atau lihat caranya.', 'Soal itu datang lagi nanti. Waktu itu kamu sudah lebih siap.'],
  },
  {
    id: 'bintang',
    menu: 'Bintang',
    title: 'Bintang dan Toko Bintang',
    tone: 'yellow',
    thumb: <KiraStar size={56} animate={false} />,
    art: (
      <span className="flex flex-col items-center gap-3">
        <Stars count={3} size={56} />
        <span className="flex items-center gap-2">
          <span className="rounded-control bg-surface p-2 shadow-soft">
            <Avatar name="rabbit" size={72} accessory="party-hat" />
          </span>
          <span className="rounded-control bg-surface p-2 shadow-soft">
            <PetCostumeThumb id="pet-crown" size={72} />
          </span>
        </span>
      </span>
    ),
    lines: ['Selesaikan sesi. Kamu dapat bintang.', 'Membaca juga dapat bintang.', 'Libur? Bintangmu tetap ada.', 'Pakai bintang di Toko Bintang.', 'Ada topi, mahkota, dan latar yang cantik.', 'Tidak perlu uang sungguhan.'],
  },
  {
    id: 'teman',
    menu: 'Teman',
    title: 'Temanmu di Dunia Kira',
    tone: 'sky',
    thumb: <EggArt size={56} />,
    art: (
      <span className="flex items-end gap-3">
        <EggArt size={96} cracked />
        <PetArt kind="moonbun" stage={2} size={136} happy />
      </span>
    ),
    lines: ['Kamu punya telur misteri.', 'Kumpulkan 5 bintang. Telurnya menetas!', 'Pilih temanmu. Beri dia nama.', 'Belajar terus. Temanmu tumbuh.', 'Libur beberapa hari? Dia tetap menunggumu.', 'Temanmu tidak pernah sakit.'],
  },
  {
    id: 'robot',
    menu: 'Robot',
    title: 'Tantangan Puzzle Robot',
    tone: 'lavender',
    thumb: <RobotArt size={56} />,
    art: <RobotArt size={160} />,
    lines: ['Puzzle Robot suka teka-teki.', 'Ada 10 soal.', 'Jawab benar 7 soal. Kamu menang!', 'Menang? Kamu dapat 10 bintang. Hadiah ini sekali seminggu.', 'Belum menang? Tidak ada yang hilang.', 'Boleh coba lagi kapan saja.'],
  },
  {
    id: 'kamus',
    menu: 'Kamus',
    title: 'Kamus ketuk',
    tone: 'sky',
    thumb: <UiIcon name="book" size={48} />,
    art: (
      <span className="flex flex-col items-center gap-3">
        <span className="font-reading text-h2 font-bold">
          The red <span className="underline decoration-dotted decoration-2 underline-offset-4">kite</span> flies.
        </span>
        <Bubble className="gap-2">
          layang-layang <UiIcon name="speaker" size={24} />
        </Bubble>
      </span>
    ),
    lines: ['Ada kata yang sulit?', 'Ketuk katanya.', 'Artinya muncul dalam bahasa Indonesia.', 'Mau dengar? Ketuk gambar speaker.', 'Simpan katanya. Nanti kamu bisa berlatih.'],
  },
  {
    id: 'bahasa',
    menu: 'Bahasa',
    title: 'Dua bahasa',
    tone: 'lavender',
    thumb: <UiIcon name="globe" size={48} />,
    art: (
      <span className="flex flex-col items-center gap-3">
        <Bubble>Lanjut</Bubble>
        <Bubble>What is 6 + 7?</Bubble>
      </span>
    ),
    lines: ['Tombol di Kira memakai bahasa Indonesia.', 'Soalnya memakai bahasa Inggris.', 'Jadi kamu berlatih bahasa Inggris setiap hari.', 'Belum paham? Ketuk katanya.'],
  },
  {
    id: 'bantuan',
    menu: 'Bantuan',
    title: 'Minta bantuan',
    tone: 'yellow',
    thumb: <UiIcon name="question" size={48} />,
    art: (
      <span className="flex items-center gap-3">
        <Avatar name="owl" size={112} />
        <span className="flex h-20 w-20 items-center justify-center rounded-pill bg-surface shadow-soft">
          <UiIcon name="question" size={48} />
        </span>
      </span>
    ),
    lines: ['Bingung? Tanya Ayah atau Bunda.', 'Layarnya macet? Beri tahu mereka.', 'Soalnya aneh? Beri tahu juga.', 'Orang yang bertanya itu berani.'],
  },
  {
    id: 'aman',
    menu: 'Aman',
    title: 'Tetap aman',
    tone: 'lavender',
    thumb: <UiIcon name="lock" size={48} />,
    art: (
      <span className="flex h-36 w-36 items-center justify-center rounded-pill bg-surface shadow-soft">
        <UiIcon name="lock" size={88} />
      </span>
    ),
    lines: ['PIN dan password itu rahasia.', 'Jangan beri tahu teman.', 'Jangan beri tahu orang yang tidak kamu kenal.', 'Ada yang membuatmu takut? Beri tahu orang dewasa.', 'Kamu tidak akan dimarahi karena bercerita.'],
  },
]

/** Panduan untuk anak kelas 1 sampai 6: gambar besar, kalimat pendek, satu kalimat per baris. Enak dibacakan orang tua. */
export function KidsGuide() {
  return (
    <GuideFrame tab="anak">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8">
        <header className="flex items-center gap-6 rounded-xl bg-yellow p-8 max-sm:flex-col max-sm:p-6 max-sm:text-center">
          <KiraStar size={144} />
          <div className="flex flex-col gap-2">
            <h1 className="m-0 font-display text-display font-semibold max-sm:text-h1">Halo! Aku Kira.</h1>
            <p className="m-0 font-display text-h3 font-medium">Aku menemanimu belajar setiap hari. Ayo lihat caranya. Boleh dibaca bersama Ayah atau Bunda.</p>
          </div>
        </header>

        <nav id="menu" aria-label="Pilih gambar">
          <p className="m-0 mb-3 font-display text-h2 font-semibold">Mau tahu apa? Ketuk gambarnya.</p>
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-5">
            {STOPS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex h-full min-h-28 flex-col items-center justify-center gap-2 rounded-card bg-surface p-2 text-center font-display font-semibold no-underline shadow-soft transition-transform duration-150 ease-kira hover:-translate-y-px">
                  <span aria-hidden="true" className="flex h-14 items-center justify-center">
                    {s.thumb}
                  </span>
                  {s.menu}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {STOPS.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-judul`} className="flex flex-col gap-5 rounded-xl bg-surface p-6 shadow-soft max-sm:p-5">
            <div className={cx('grid items-center gap-6 md:grid-cols-2', i % 2 === 1 && 'md:[&>*:first-child]:order-2')}>
              <div aria-hidden="true" className={cx('flex min-h-56 items-center justify-center rounded-card p-5', TONE_BG[s.tone])}>
                {s.art}
              </div>
              <div className="flex flex-col gap-3">
                <h2 id={`${s.id}-judul`} className="m-0 text-h1 font-semibold max-sm:text-h2">
                  {s.title}
                </h2>
                {s.lines.map((line) => (
                  <p key={line} className="m-0 font-reading text-h3 font-semibold sm:text-h2">
                    {line}
                  </p>
                ))}
                <a href="#menu" className="inline-flex min-h-11 w-fit items-center gap-1 font-bold">
                  <UiIcon name="arrow-up" size={20} />
                  Pilih gambar lain
                </a>
              </div>
            </div>
          </section>
        ))}

        <section aria-labelledby="dewasa-judul" className="flex flex-col gap-2 rounded-card bg-lavender p-6 max-sm:p-5">
          <h2 id="dewasa-judul" className="m-0 text-h3 font-semibold">
            Untuk Ayah dan Bunda
          </h2>
          <p className="m-0">
            Halaman ini dibuat untuk dibacakan. Pengaturan, laporan, dan aturan data ada di <a href="/panduan">panduan orang tua</a>.
          </p>
        </section>
      </div>
    </GuideFrame>
  )
}
