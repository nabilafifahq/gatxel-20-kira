import Link from 'next/link'
import { dateId } from '@/components/console/format'
import { FAMILY_ROUTES } from '@/components/console/routes'
import { cx } from '@/components/console/cx'
import { numberWordId, type PrivacyNoticeData } from './legal'
import { LegalLayout, LegalSection, LegalTable, TD, TH_COL } from './LegalLayout'

/**
 * P02 Kebijakan Privasi (papan Privasi). Komponen server, teks Bahasa Indonesia dari
 * papan dan dinyatakan sebagai teks yang berlaku. Identitas Pengelola, tanggal,
 * tujuan persetujuan, tabel data, dan penerima datang dari `data` (lihat legal.ts).
 * Masa simpan selalu dalam satuan waktu.
 */

export type PrivacyNoticePageProps = { data: PrivacyNoticeData }

const TOC = [
  { id: 'pengelola', label: '1. Pengelola data' },
  { id: 'anak', label: '2. Data anak dan persetujuan' },
  { id: 'data', label: '3. Data, tujuan, dan lama simpan' },
  { id: 'penerima', label: '4. Penerima dan lokasi data' },
  { id: 'hak', label: '5. Hak Orang Tua dan anak' },
  { id: 'otomatis', label: '6. Pemilihan soal otomatis' },
  { id: 'keamanan', label: '7. Keamanan dan kebocoran' },
  { id: 'perubahan', label: '8. Perubahan dan versi' },
]

const RIGHTS = [
  'Mendapat informasi tentang pemrosesan data.',
  'Melengkapi, memperbarui, dan memperbaiki data yang keliru.',
  'Mengakses data dan mendapat salinannya.',
  'Mengakhiri pemrosesan dan meminta data dihapus.',
  'Menarik persetujuan.',
  'Mengajukan keberatan atas keputusan otomatis.',
  'Menunda atau membatasi pemrosesan.',
  'Menggugat dan menerima ganti rugi atas pelanggaran.',
  'Mendapat data dalam format yang umum dipakai dan memindahkannya.',
]

export function PrivacyNoticePage({ data }: PrivacyNoticePageProps) {
  const { entity, meta } = data
  const effective = dateId(meta.effectiveDate)
  const abroad = data.recipients.some((r) => r.abroad)
  const contact = entity.phone ? `${entity.email} atau ${entity.phone}` : entity.email
  return (
    <LegalLayout
      current="privacy"
      title="Kebijakan Privasi"
      meta={`Versi ${meta.version}, berlaku ${effective}. Teks Bahasa Indonesia ini yang berlaku.`}
      toc={TOC}
      footerNote={`${entity.name}, ${entity.address}`}
    >
      <section aria-label="Ringkasan" className="flex flex-col gap-2 rounded-card border-2 border-fg bg-surface px-6 py-5 max-sm:px-4">
        <p className="m-0 font-bold">Ringkasan</p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-[22px]">
          <li>Data anak hanya diproses setelah Orang Tua memberi persetujuan untuk setiap tujuan.</li>
          <li>
            Data disimpan di {data.storageLocation}.
            {abroad ? ' Sebagian kecil dikirim ke penerima di luar Indonesia, dengan persetujuan terpisah.' : ''}
          </li>
          <li>Persetujuan bisa ditarik kapan saja dari halaman Privasi keluarga. Pemrosesan berhenti paling lambat 3 x 24 jam.</li>
          <li>Kira tidak memuat iklan dan tidak menjual data.</li>
        </ul>
      </section>

      <LegalSection id="pengelola" title="1. Pengelola data">
        <p className="m-0">
          Kira dikelola oleh {entity.name}, beralamat di {entity.address}. Pertanyaan, permintaan, dan keluhan soal data pribadi dikirim ke {contact}. Di dokumen
          ini pihak tersebut disebut Pengelola.
        </p>
        <p className="m-0">
          Kira dipakai oleh satu keluarga: pemilik akun keluarga yang juga tutor, Orang Tua, dan anak sebagai learner. Pengelola tidak wajib menunjuk petugas
          pelindungan data menurut Pasal 53 UU PDP, sehingga semua permintaan ditangani langsung oleh Pengelola.
        </p>
      </LegalSection>

      <LegalSection id="anak" title="2. Data anak dan persetujuan">
        <p className="m-0">
          Anak berarti setiap orang yang berusia di bawah 18 tahun. Akun anak hanya dibuat oleh orang dewasa, dan baru aktif setelah Orang Tua memberi
          persetujuan sesuai Pasal 25 UU PDP. Anak masuk dengan PIN gambar di perangkat yang didaftarkan orang dewasa.
        </p>
        <p className="m-0">
          Persetujuan diberikan terpisah untuk {numberWordId(data.purposes.length)} tujuan. Setiap kotak kosong saat pertama dibuka dan tidak pernah dicentang
          otomatis. Kira mencatat versi pemberitahuan, tujuan, waktu, dan cara persetujuan diberikan.
        </p>
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-[26px]">
          {data.purposes.map((p) => (
            <li key={p.title}>
              <strong>{p.title}.</strong> {p.description}
            </li>
          ))}
        </ol>
        <p className="m-0">
          Penarikan persetujuan dilakukan dari halaman <Link href={FAMILY_ROUTES.privacy}>Privasi keluarga</Link>. Pemrosesan untuk tujuan itu berhenti paling
          lambat 3 x 24 jam sejak penarikan, lalu data diekspor atau dihapus sesuai pilihan Orang Tua.
        </p>
      </LegalSection>

      <LegalSection id="data" title="3. Data, tujuan, dasar hukum, dan lama simpan">
        <p className="m-0">Dasar hukum mengacu pada Pasal 20 ayat (2) UU PDP.</p>
        <LegalTable caption="Data, tujuan, dasar hukum, dan lama simpan" minWidth={680}>
          <thead>
            <tr>
              <th scope="col" className={TH_COL}>
                Data
              </th>
              <th scope="col" className={TH_COL}>
                Tujuan
              </th>
              <th scope="col" className={TH_COL}>
                Dasar hukum
              </th>
              <th scope="col" className={TH_COL}>
                Disimpan
              </th>
            </tr>
          </thead>
          <tbody>
            {data.dataRows.map((r, i) => {
              const last = i === data.dataRows.length - 1
              return (
                <tr key={r.data}>
                  <th scope="row" className={cx(TD, 'text-left font-normal', last && 'border-b-0')}>
                    <span className="block font-bold">{r.data}</span>
                    <span className="text-fg-muted">{r.detail}</span>
                  </th>
                  <td className={cx(TD, last && 'border-b-0')}>{r.purpose}</td>
                  <td className={cx(TD, last && 'border-b-0')}>{r.basis}</td>
                  <td className={cx(TD, last && 'border-b-0')}>{r.retention}</td>
                </tr>
              )
            })}
          </tbody>
        </LegalTable>
        <p className="m-0">
          Kira hanya memakai cookie yang dibutuhkan untuk masuk dan keamanan: cookie sesi orang dewasa yang berlaku {data.sessionHours} jam, dan token perangkat
          tablet anak yang berlaku {data.deviceTokenDays} hari. Tidak ada cookie iklan, pelacak pihak ketiga, atau alat analitik eksternal.
        </p>
      </LegalSection>

      <LegalSection id="penerima" title="4. Penerima dan lokasi data">
        <p className="m-0">
          Penerima di bawah memproses data atas perintah Pengelola dan tidak memakainya untuk kepentingan sendiri. Pengiriman ke luar Indonesia memakai
          persetujuan terpisah dari Orang Tua menurut Pasal 56 UU PDP.
        </p>
        <LegalTable caption="Penerima dan lokasi data" minWidth={560}>
          <thead>
            <tr>
              <th scope="col" className={TH_COL}>
                Penerima
              </th>
              <th scope="col" className={TH_COL}>
                Data yang diterima
              </th>
              <th scope="col" className={TH_COL}>
                Lokasi
              </th>
            </tr>
          </thead>
          <tbody>
            {data.recipients.map((r, i) => {
              const last = i === data.recipients.length - 1
              return (
                <tr key={r.name}>
                  <th scope="row" className={cx(TD, 'text-left font-bold', last && 'border-b-0')}>
                    {r.name}
                  </th>
                  <td className={cx(TD, last && 'border-b-0')}>{r.data}</td>
                  <td className={cx(TD, last && 'border-b-0')}>{r.location}</td>
                </tr>
              )
            })}
          </tbody>
        </LegalTable>
        <p className="m-0">
          Penerima baru diberitahukan kepada Orang Tua paling lambat 14 hari sebelum mulai dipakai. Kalau penerima baru berada di luar Indonesia, persetujuan
          diminta lagi sebelum data dikirim.
        </p>
      </LegalSection>

      <LegalSection id="hak" title="5. Hak Orang Tua dan anak">
        <p className="m-0">Orang Tua menjalankan hak berikut atas nama anak, sesuai Pasal 5 sampai Pasal 13 UU PDP:</p>
        <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-[26px]">
          {RIGHTS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
        <p className="m-0">
          Hak nomor 3, 4, 5, dan 9 bisa dijalankan sendiri dari halaman <Link href={FAMILY_ROUTES.privacy}>Privasi keluarga</Link>. Hak lainnya diajukan ke{' '}
          {entity.email}. Setiap permintaan mendapat kode referensi dan ditanggapi paling lambat 3 x 24 jam sejak diterima.
        </p>
      </LegalSection>

      <LegalSection id="otomatis" title="6. Pemilihan soal otomatis">
        <p className="m-0">
          Kira menghitung penguasaan setiap skill dari jawaban anak. Hasilnya dipakai untuk dua hal saja: memilih soal berikutnya dan mengisi laporan keluarga.
          Hasil ini tidak dipakai untuk iklan, tidak dijual, dan tidak dibagikan ke sekolah atau penyelenggara lomba.
        </p>
        <p className="m-0">
          Orang Tua bisa mengajukan keberatan atas pemilihan soal otomatis ke {entity.email}. Setelah itu tutor menyusun soal secara manual untuk anak tersebut.
        </p>
      </LegalSection>

      <LegalSection id="keamanan" title="7. Keamanan dan kebocoran data">
        <p className="m-0">
          Data dienkripsi saat dikirim dan saat disimpan. Setiap akun hanya bisa membuka data keluarganya sendiri, dan setiap akses ke data anak tercatat di log
          audit. Password orang dewasa minimal 15 karakter dan diperiksa terhadap daftar password yang pernah bocor.
        </p>
        <p className="m-0">
          Kalau terjadi kebocoran data, Pengelola memberi tahu Orang Tua dan lembaga yang berwenang paling lambat 3 x 24 jam. Pemberitahuan itu menyebut data apa
          yang terungkap, kapan dan bagaimana kejadiannya, serta langkah penanganan dan pemulihannya.
        </p>
      </LegalSection>

      <LegalSection id="perubahan" title="8. Perubahan dan versi">
        <p className="m-0">
          Perubahan pemberitahuan ini dikirim ke email Orang Tua paling lambat 14 hari sebelum versi baru berlaku. Kalau perubahan menambah tujuan atau jenis
          data, persetujuan diminta ulang dan pemrosesan baru tidak dimulai sebelum persetujuan itu ada.
        </p>
        <p className="m-0">
          Versi sebelumnya tetap bisa dibaca di halaman ini. Versi yang berlaku adalah versi {meta.version}, mulai {effective}.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
