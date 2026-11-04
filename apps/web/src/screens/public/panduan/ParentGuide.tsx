import { ButtonLink } from '@/components/console/Button'
import { KiraStar } from '@/components/ui/KiraStar'
import { GuideFrame } from './GuideFrame'
import { GuideNav, type TocGroup } from './GuideNav'
import { A, FAQ, GROUPS, L, MULAI, SWITCHES } from './parent-content'
import { Faq, FeatureCard, GroupHeading, Shot, Steps } from './parts'

const TOC: TocGroup[] = [
  { title: 'Mulai', items: [{ id: 'mulai', label: 'Mulai dalam 5 menit' }] },
  ...GROUPS.map((g) => ({ title: g.title, items: g.features.map((f) => ({ id: f.id, label: f.short ?? f.title })) })),
  {
    title: 'Pertanyaan dan bantuan',
    items: [
      { id: 'tanya', label: 'Tanya jawab' },
      { id: 'bantuan', label: 'Hubungi kami' },
    ],
  },
]

/** Panduan orang tua: mulai cepat, satu bagian per fitur, tanya jawab, dan bantuan. Publik, dibaca di HP dari tautan WhatsApp. */
export function ParentGuide({ contact }: { contact: string }) {
  return (
    <GuideFrame tab="ortu">
      <header className="mb-6 flex items-center gap-6 rounded-xl bg-lavender p-8 max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:p-6">
        <KiraStar size={104} className="max-sm:hidden" />
        <div className="flex flex-col gap-3">
          <h1 className="m-0 font-display text-h1 font-semibold">Panduan Kira untuk orang tua</h1>
          <p className="m-0 max-w-[60ch] text-body-lg">Semua yang perlu Ayah/Bunda ketahui: cara mulai, cara kerja setiap fitur dengan contoh anak, dan apa saja yang bisa diatur. Tidak perlu masuk untuk membacanya.</p>
          <p className="m-0 max-w-[60ch]">
            Kira adalah ruang belajar harian untuk anak SD kelas 1 sampai 6, mengacu pada kerangka Cambridge Primary. Tombol di layar anak berbahasa Indonesia, soalnya kebanyakan berbahasa Inggris. Anak yang ingin membaca sendiri punya <A href="/panduan/anak">panduan bergambar</A>.
          </p>
        </div>
      </header>

      <div className="grid items-start gap-x-10 lg:grid-cols-[250px_minmax(0,1fr)]">
        <GuideNav groups={TOC} />

        <div className="flex min-w-0 flex-col gap-5 pt-4 lg:pt-0">
          <section id="mulai" aria-labelledby="mulai-judul" className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h2 id="mulai-judul" className="m-0 text-h1 font-semibold max-sm:text-h2">
                Mulai dalam 5 menit
              </h2>
              <p className="m-0 max-w-[62ch] text-body-lg">Enam langkah dari daftar sampai anak mengerjakan soal pertamanya. Siapkan email yang dibaca setiap hari, dan perangkat yang akan dipakai anak.</p>
            </div>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {MULAI.map((s, i) => (
                <li key={s.title} className="flex gap-4 rounded-card bg-surface p-5 shadow-soft">
                  <span aria-hidden="true" className="flex h-12 w-12 flex-none items-center justify-center rounded-pill bg-yellow font-numbers text-h2 font-bold tabular-nums">
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="m-0 text-h3 font-semibold">{s.title}</h3>
                    <p className="m-0">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="grid max-w-[560px] grid-cols-2 gap-4">
              <Shot src="keluarga.webp" width={585} height={960} alt="Halaman Keluarga: kartu tiap anak dengan streak, waktu belajar, dan tombol Lihat." caption="Halaman Keluarga untuk Ayah/Bunda" />
              <Shot src="pin.webp" width={585} height={960} alt="Layar masuk anak: sembilan gambar untuk PIN, antara lain matahari, bulan, dan bintang." caption="Anak masuk dengan empat gambar" />
            </div>
          </section>

          {GROUPS.map((g) => (
            <div key={g.title} className="flex flex-col gap-5">
              <GroupHeading id={`kelompok-${g.id}`} title={g.title} intro={g.intro} />
              {g.features.map((f) => (
                <div key={f.id} className="flex flex-col gap-5">
                  <FeatureCard f={f} />
                  {f.id === 'saklar' ? <SwitchTable /> : null}
                </div>
              ))}
            </div>
          ))}

          <section id="tanya" aria-labelledby="tanya-judul" className="flex flex-col gap-3 pt-8">
            <h2 id="tanya-judul" className="m-0 text-h1 font-semibold max-sm:text-h2">
              Tanya jawab
            </h2>
            {FAQ.map((q) => (
              <Faq key={q.id} id={q.id} q={q.q}>
                {q.a}
              </Faq>
            ))}
          </section>

          <section id="bantuan" aria-labelledby="bantuan-judul" className="mt-8 flex flex-col gap-4 rounded-xl bg-lavender p-8 max-sm:p-6">
            <h2 id="bantuan-judul" className="m-0 text-h1 font-semibold max-sm:text-h2">
              Hubungi kami
            </h2>
            <p className="m-0 max-w-[60ch] text-body-lg">Ada yang membingungkan atau tidak berjalan? Tulis di halaman Bantuan dan masukan: pilih kategori, isi subjek dan pesan, dan kalau perlu lampirkan foto layar atau video pendek. Di halaman itu juga ada tombol untuk chat lewat WhatsApp.</p>
            <div>
              <ButtonLink href="/feedback" variant="primary">
                Buka halaman bantuan
              </ButtonLink>
            </div>
            <p className="m-0 max-w-[60ch]">
              Lampiran boleh berupa png, jpg, pdf, atau mp4, sampai 5 MB. Jangan menulis password atau PIN. Lebih suka email? Tulis ke{' '}
              <a href={`mailto:${contact}`} className="font-bold break-all underline underline-offset-3">
                {contact}
              </a>
              .
            </p>
            <h3 className="m-0 mt-2 text-h3 font-semibold">Laporkan soal yang salah</h3>
            <Steps
              chip="bg-surface"
              items={[
                'Foto layar soalnya, supaya soal yang dimaksud mudah ditemukan.',
                <>
                  Buka <A href="/feedback">halaman bantuan</A>, pilih kategori <L>Koreksi soal atau materi</L>, tulis apa yang keliru, lalu lampirkan fotonya.
                </>,
                'Anak juga bisa mengetuk tombol bendera di layar soal untuk menandai soal itu.',
              ]}
            />
            <p className="m-0">
              Aturan lengkap ada di <A href="/privasi">Kebijakan Privasi</A> dan <A href="/ketentuan">Syarat dan Ketentuan</A>.
            </p>
          </section>
        </div>
      </div>
    </GuideFrame>
  )
}

/** Daftar semua saklar di halaman anak, sesuai urutan di layar. */
function SwitchTable() {
  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-6 shadow-soft max-sm:p-5">
      <h4 className="m-0 font-display text-h3 font-semibold">Arti setiap saklar</h4>
      {SWITCHES.map((g) => (
        <div key={g.title} className="flex flex-col gap-1">
          <p className="m-0 font-bold">{g.title}</p>
          <dl className="m-0 flex flex-col">
            {g.items.map(([name, body]) => (
              <div key={name} className="grid gap-x-4 border-t border-divider py-2 sm:grid-cols-[200px_minmax(0,1fr)]">
                <dt className="font-semibold">
                  <L>{name}</L>
                </dt>
                <dd className="m-0">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  )
}
