import { renderEmail, type EmailBlock, type EmailIdentity, type RenderedEmail } from './email'

/**
 * Isi semua email Kira, satu fungsi per jenis. Orang tua selalu disapa "Anda". Subjek tenang dalam bahasa Indonesia,
 * tanpa huruf besar semua, kata promosi, atau emoji. Dipakai web, worker, dan perintah admin (contoh di EMAIL_SAMPLES).
 */

const WHY_REQUEST = 'Anda menerima email ini karena alamat ini dimasukkan di Kira.'
const WHY_ACCOUNT = 'Anda menerima email ini karena alamat ini terhubung dengan akun Kira.'
const WHY_WAITLIST = 'Anda menerima email ini karena alamat ini masuk daftar tunggu Kira. Anda bisa berhenti kapan saja.'

const unsubscribeLink = (url: string) => [{ label: 'Berhenti berlangganan', url }]

export function signupVerifyEmail(id: EmailIdentity, input: { url: string }): RenderedEmail {
  return renderEmail(
    {
      subject: 'Konfirmasi email untuk akun Kira Anda',
      preheader: 'Satu langkah lagi: pastikan email ini milik Anda. Tautan berlaku 24 jam.',
      heading: 'Konfirmasi email Anda',
      blocks: [{ kind: 'text', text: 'Terima kasih sudah mendaftar di Kira. Tekan tombol di bawah untuk memastikan email ini milik Anda. Setelah itu keluarga Anda dibuat dan Anda bisa menambahkan anak.' }],
      action: { label: 'Konfirmasi email', url: input.url },
      after: [{ kind: 'text', text: 'Tautan ini berlaku 24 jam dan hanya bisa dipakai sekali. Di halaman konfirmasi, Anda akan diminta memasukkan password yang dibuat saat mendaftar.' }],
      ignoreLine: true,
      why: WHY_REQUEST,
    },
    id,
  )
}

export function signupExistingEmail(id: EmailIdentity, input: { loginUrl: string }): RenderedEmail {
  return renderEmail(
    {
      subject: 'Email ini sudah punya akun Kira',
      preheader: 'Ada pendaftaran baru dengan email Anda, padahal akunnya sudah ada.',
      heading: 'Email ini sudah terdaftar',
      blocks: [{ kind: 'text', text: 'Ada pendaftaran baru di Kira memakai email ini, padahal akunnya sudah ada. Kalau itu Anda, silakan masuk. Bila lupa password, pilih Lupa password di halaman masuk.' }],
      action: { label: 'Masuk ke Kira', url: input.loginUrl },
      after: [{ kind: 'text', text: 'Tidak ada yang berubah di akun Anda.' }],
      ignoreLine: true,
      why: WHY_ACCOUNT,
    },
    id,
  )
}

export function passwordResetEmail(id: EmailIdentity, input: { url: string }): RenderedEmail {
  return renderEmail(
    {
      subject: 'Atur ulang password Kira Anda',
      preheader: 'Tautan untuk membuat password baru. Berlaku 30 menit.',
      heading: 'Atur ulang password',
      blocks: [{ kind: 'text', text: 'Kami menerima permintaan untuk mengatur ulang password akun Kira dengan email ini. Tekan tombol di bawah untuk membuat password baru.' }],
      action: { label: 'Atur ulang password', url: input.url },
      after: [{ kind: 'text', text: 'Tautan ini berlaku 30 menit dan hanya bisa dipakai sekali. Selama belum diganti, password lama tetap berlaku.' }],
      ignoreLine: true,
      why: WHY_ACCOUNT,
    },
    id,
  )
}

export function inviteEmail(id: EmailIdentity, input: { url: string; role: 'tutor' | 'guardian'; orgName: string }): RenderedEmail {
  return renderEmail(
    {
      subject: `Undangan bergabung di Kira ${input.orgName}`,
      preheader: 'Terima undangan ini untuk mulai memakai Kira. Berlaku 7 hari.',
      heading: `Undangan dari Kira ${input.orgName}`,
      blocks: [
        {
          kind: 'text',
          text:
            input.role === 'guardian'
              ? 'Anda diundang sebagai orang tua di Kira untuk melihat ringkasan belajar mingguan dan mengatur persetujuan data anak.'
              : 'Anda diundang sebagai tutor di Kira.',
        },
      ],
      action: { label: 'Terima undangan', url: input.url },
      after: [{ kind: 'text', text: 'Tautan ini berlaku 7 hari dan hanya bisa dipakai sekali. Buka dari browser di HP atau laptop, tanpa perlu memasang aplikasi tambahan.' }],
      ignoreLine: true,
      why: WHY_REQUEST,
    },
    id,
  )
}

export function consentRequestEmail(id: EmailIdentity, input: { url: string; actorName: string; learnerName: string; orgName: string }): RenderedEmail {
  return renderEmail(
    {
      subject: `Persetujuan untuk ${input.learnerName} di Kira`,
      preheader: `${input.learnerName} bisa mulai belajar setelah persetujuan Anda.`,
      heading: `Persetujuan untuk ${input.learnerName}`,
      blocks: [
        { kind: 'text', text: `${input.actorName} menambahkan ${input.learnerName} di Kira ${input.orgName}.` },
        { kind: 'text', text: `${input.learnerName} bisa mulai belajar di tablet setelah Anda memberi persetujuan di halaman Privasi.` },
      ],
      action: { label: 'Buka halaman Privasi', url: input.url },
      why: 'Anda menerima email ini karena akun orang tua ini tertaut ke anak tersebut di Kira.',
    },
    id,
  )
}

export function waitlistConfirmEmail(id: EmailIdentity, input: { url: string; unsubscribeUrl: string }): RenderedEmail {
  return renderEmail(
    {
      subject: 'Konfirmasi daftar tunggu Kira',
      preheader: 'Tekan tombol konfirmasi supaya kami boleh mengabari Anda saat kursi dibuka.',
      heading: 'Konfirmasi daftar tunggu',
      blocks: [
        { kind: 'text', text: 'Ada permintaan untuk dikabari saat kursi beta Kira dibuka kembali memakai email ini.' },
        { kind: 'text', text: 'Tekan tombol di bawah untuk mengonfirmasi. Tanpa konfirmasi, kami tidak mengirim kabar apa pun.' },
      ],
      action: { label: 'Ya, kabari saya', url: input.url },
      after: [{ kind: 'text', text: 'Konfirmasi ini berlaku 14 hari.' }],
      ignoreLine: true,
      why: WHY_REQUEST,
      footerLinks: unsubscribeLink(input.unsubscribeUrl),
    },
    id,
  )
}

export function waitlistWelcomeEmail(id: EmailIdentity, input: { unsubscribeUrl: string }): RenderedEmail {
  return renderEmail(
    {
      subject: 'Anda ada di daftar tunggu Kira',
      preheader: 'Kami mengabari Anda saat kursi beta dibuka kembali.',
      heading: 'Anda ada di daftar tunggu',
      blocks: [
        { kind: 'text', text: 'Terima kasih. Kami akan mengirim email saat kursi beta dibuka kembali.' },
        { kind: 'text', text: 'Kami hanya mengirim kabar tentang kursi dan perkembangan Kira, dan tidak membagikan alamat Anda ke pihak lain.' },
      ],
      why: WHY_WAITLIST,
      footerLinks: unsubscribeLink(input.unsubscribeUrl),
    },
    id,
  )
}

export function seatReopenedEmail(id: EmailIdentity, input: { signupUrl: string; unsubscribeUrl: string }): RenderedEmail {
  return renderEmail(
    {
      subject: 'Kursi beta Kira dibuka kembali',
      preheader: 'Ada kursi beta Kira yang kosong untuk keluarga Anda.',
      heading: 'Kursi beta dibuka kembali',
      blocks: [{ kind: 'text', text: 'Ada kursi beta Kira yang kosong. Jumlahnya terbatas dan diisi sesuai urutan pendaftaran, jadi keluarga Anda bisa mendaftar kapan pun selagi masih ada.' }],
      action: { label: 'Daftar di Kira', url: input.signupUrl },
      why: WHY_WAITLIST,
      footerLinks: unsubscribeLink(input.unsubscribeUrl),
    },
    id,
  )
}

export function deletionRequestEmail(id: EmailIdentity, input: { url: string; learnerName: string; reference: string; dateLabel: string }): RenderedEmail {
  return renderEmail(
    {
      subject: `Permintaan hapus akun ${input.learnerName} tercatat`,
      preheader: `Akun ${input.learnerName} dihapus pada ${input.dateLabel}. Anda masih bisa membatalkannya.`,
      heading: 'Permintaan hapus akun tercatat',
      blocks: [
        { kind: 'code', label: 'Nomor referensi', value: input.reference },
        { kind: 'text', text: `Akun dan data belajar ${input.learnerName} akan dihapus pada ${input.dateLabel}. Sampai tanggal itu, ${input.learnerName} tidak bisa masuk ke Kira.` },
        { kind: 'text', text: `Untuk membatalkan, buka halaman Privasi lalu pilih Batalkan penghapusan sebelum ${input.dateLabel}.` },
      ],
      action: { label: 'Buka halaman Privasi', url: input.url },
      after: [{ kind: 'text', text: 'Kalau permintaan ini bukan dari Anda, buka halaman Privasi dan batalkan sekarang.' }],
      why: WHY_ACCOUNT,
    },
    id,
  )
}

export function dataExportEmail(id: EmailIdentity, input: { url: string; learnerName: string; whenLabel: string }): RenderedEmail {
  return renderEmail(
    {
      subject: `Salinan data ${input.learnerName} sudah diunduh`,
      preheader: `Salinan data belajar ${input.learnerName} diunduh dari akun Anda.`,
      heading: 'Salinan data sudah diunduh',
      blocks: [
        { kind: 'text', text: `Salinan data belajar ${input.learnerName} diunduh dari akun Anda pada ${input.whenLabel} WIB. Berkasnya hanya tersimpan di perangkat yang mengunduhnya.` },
      ],
      action: { label: 'Buka halaman Privasi', url: input.url },
      after: [{ kind: 'text', text: 'Kalau bukan Anda yang mengunduh, segera ganti password dan hubungi kami lewat halaman Bantuan.' }],
      why: WHY_ACCOUNT,
    },
    id,
  )
}

/** Balasan otomatis ke pengirim. Sengaja tidak menerima subjek atau isi pesan, jadi formulir tidak bisa dipakai menyebarkan teks ke orang lain. */
export function supportConfirmEmail(id: EmailIdentity, input: { reference: string; categoryLabel: string }): RenderedEmail {
  return renderEmail(
    {
      subject: `Pesan Anda ke Kira sudah kami terima (${input.reference})`,
      preheader: `Nomor referensi Anda ${input.reference}. Tim Kira akan membalas lewat email.`,
      heading: 'Pesan Anda sudah kami terima',
      blocks: [
        { kind: 'code', label: 'Nomor referensi', value: input.reference },
        { kind: 'text', text: `Terima kasih sudah menghubungi kami. Pesan Anda tercatat dengan kategori ${input.categoryLabel}. Tim Kira di Gatxel akan membalas ke alamat ini secepatnya, biasanya dalam 3 hari kerja.` },
        { kind: 'text', text: 'Sebutkan nomor referensi di atas bila Anda menghubungi kami lagi soal pesan ini.' },
      ],
      ignoreLine: true,
      why: 'Anda menerima email ini karena alamat ini dipakai untuk mengirim pesan di halaman Bantuan Kira.',
    },
    id,
  )
}

export type SupportTicketEmailInput = {
  reference: string
  tag: string
  categoryLabel: string
  subject: string
  message: string
  senderEmail: string
  senderKind: string
  accountId: string | null
  accountRole: string | null
  userAgent: string
  screen: string
  appVersion: string
  whenLabel: string
  pageFrom: string
  attachment: { name: string; mime: string; bytes: number } | null
}

export const supportSubject = (tag: string, subject: string, reference: string): string => `[Kira][${tag}] ${subject} (${reference})`

/** Email ke tim Gatxel. Semua isian pengguna di-escape oleh renderEmail. */
export function supportTicketEmail(id: EmailIdentity, t: SupportTicketEmailInput): RenderedEmail {
  const facts: { label: string; value: string }[] = [
    { label: 'Kategori', value: t.categoryLabel },
    { label: 'Pengirim', value: `${t.senderEmail} (${t.senderKind})` },
    ...(t.accountId ? [{ label: 'Akun', value: `${t.accountId} (${t.accountRole ?? 'tanpa peran'})` }] : []),
    { label: 'Waktu', value: `${t.whenLabel} WIB` },
    { label: 'Halaman asal', value: t.pageFrom || 'tidak diketahui' },
    { label: 'Versi aplikasi', value: t.appVersion },
    { label: 'Layar', value: t.screen || 'tidak diketahui' },
    { label: 'Browser', value: t.userAgent || 'tidak diketahui' },
    { label: 'Lampiran', value: t.attachment ? `${t.attachment.name} (${t.attachment.mime}, ${formatBytes(t.attachment.bytes)})` : 'tidak ada' },
  ]
  const blocks: EmailBlock[] = [
    { kind: 'code', label: 'Nomor referensi', value: t.reference },
    { kind: 'callout', title: t.subject, text: t.message },
    { kind: 'facts', rows: facts },
    { kind: 'text', text: `Balas email ini untuk menjawab langsung ke ${t.senderEmail}.` },
  ]
  return renderEmail(
    {
      subject: supportSubject(t.tag, t.subject, t.reference),
      preheader: `${t.categoryLabel} dari ${t.senderEmail}`,
      heading: `Pesan baru: ${t.categoryLabel}`,
      blocks,
      why: 'Email ini dikirim ke tim Gatxel dari halaman Bantuan Kira.',
    },
    id,
  )
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Bentuk data untuk ringkasan mingguan. Kalimatnya disusun web dari data belajar. */
export type WeekReportInput = {
  subject: string
  weekLabel: string
  firstWeekNote: string | null
  studyLine: string
  questLine: string
  skillsUp: { lead: string; text: string }[]
  skillsUpEmpty: string
  skillsToRepeat: { lead: string; text: string }[]
  skillsToRepeatEmpty: string
  arena: string | null
  tutorNote: string | null
  nextCompetition: { name: string; dateLabel: string } | null
  coach: {
    note: string | null
    items: { lead: string; text: string }[]
    starter: { lead: string; text: string } | null
    strength: string | null
    praise: string
    url: string | null
  } | null
  reportUrl: string | null
  privacyUrl: string | null
  controller: string | null
}

export function weekReportEmail(id: EmailIdentity, w: WeekReportInput): RenderedEmail {
  const blocks: EmailBlock[] = [{ kind: 'text', text: w.weekLabel }]
  if (w.firstWeekNote) blocks.push({ kind: 'callout', text: w.firstWeekNote })
  blocks.push({ kind: 'text', text: `${w.studyLine} ${w.questLine}`, strong: true })
  blocks.push({ kind: 'heading', text: 'Naik minggu ini' })
  blocks.push(w.skillsUp.length ? { kind: 'list', items: w.skillsUp } : { kind: 'text', text: w.skillsUpEmpty })
  blocks.push({ kind: 'heading', text: 'Perlu diulang' })
  blocks.push(w.skillsToRepeat.length ? { kind: 'list', items: w.skillsToRepeat } : { kind: 'text', text: w.skillsToRepeatEmpty })
  if (w.arena) blocks.push({ kind: 'heading', text: 'Arena' }, { kind: 'text', text: w.arena })
  if (w.tutorNote) blocks.push({ kind: 'heading', text: 'Catatan tutor' }, { kind: 'callout', text: w.tutorNote })
  if (w.nextCompetition) blocks.push({ kind: 'heading', text: 'Lomba berikutnya' }, { kind: 'text', text: `${w.nextCompetition.name}: ${w.nextCompetition.dateLabel}.` })
  if (w.coach) {
    blocks.push({ kind: 'heading', text: 'Pelatih minggu ini: 10 menit di rumah' })
    if (w.coach.note) blocks.push({ kind: 'text', text: w.coach.note })
    if (w.coach.items.length) blocks.push({ kind: 'list', items: w.coach.items })
    else if (w.coach.starter) blocks.push({ kind: 'list', items: [w.coach.starter] })
    if (w.coach.strength) blocks.push({ kind: 'text', text: `Yang patut dipuji: ${w.coach.strength}.` })
    blocks.push({ kind: 'callout', title: 'Kalimat untuk anak:', text: w.coach.praise })
    if (w.coach.url) blocks.push({ kind: 'link', label: 'Lihat semua kegiatan dan lembar kerja', url: w.coach.url })
  }
  return renderEmail(
    {
      subject: w.subject,
      preheader: `${w.studyLine} ${w.questLine}`,
      heading: w.subject,
      blocks,
      ...(w.reportUrl ? { action: { label: 'Buka laporan lengkap', url: w.reportUrl } } : {}),
      why: `Anda menerima email ini karena persetujuan laporan kemajuan lewat email aktif.${w.controller ? ` ${w.controller}.` : ''}`,
      ...(w.privacyUrl ? { footerLinks: [{ label: 'Atur persetujuan', url: w.privacyUrl }] } : {}),
    },
    id,
  )
}

/** Satu contoh per jenis email untuk perintah admin email-samples. Tautan menuju rute sungguhan dengan token yang tidak berlaku. */
export function emailSamples(id: EmailIdentity): { kind: string; mail: RenderedEmail; listUnsubscribe?: string; replyTo?: string }[] {
  const o = id.origin.replace(/\/$/, '')
  const token = 'Contoh000Contoh000Contoh000Contoh000'
  const unsub = `${o}/kabar/berhenti/${token}`
  const oneClick = `${o}/api/kabar/berhenti/${token}`
  const learnerUrl = `${o}/keluarga/privasi`
  return [
    { kind: 'sample-signup-verify', mail: signupVerifyEmail(id, { url: `${o}/daftar/konfirmasi/${token}` }) },
    { kind: 'sample-signup-existing', mail: signupExistingEmail(id, { loginUrl: `${o}/masuk` }) },
    { kind: 'sample-password-reset', mail: passwordResetEmail(id, { url: `${o}/reset/${token}` }) },
    { kind: 'sample-invite', mail: inviteEmail(id, { url: `${o}/undangan/${token}`, role: 'guardian', orgName: 'Keluarga Wiratama' }) },
    { kind: 'sample-consent-request', mail: consentRequestEmail(id, { url: learnerUrl, actorName: 'Bu Sari', learnerName: 'Alya', orgName: 'Keluarga Wiratama' }) },
    { kind: 'sample-waitlist-confirm', mail: waitlistConfirmEmail(id, { url: `${o}/kabar/konfirmasi/${token}`, unsubscribeUrl: unsub }), listUnsubscribe: oneClick },
    { kind: 'sample-waitlist-welcome', mail: waitlistWelcomeEmail(id, { unsubscribeUrl: unsub }), listUnsubscribe: oneClick },
    { kind: 'sample-seat-reopened', mail: seatReopenedEmail(id, { signupUrl: `${o}/daftar`, unsubscribeUrl: unsub }), listUnsubscribe: oneClick },
    { kind: 'sample-week-report', mail: weekReportEmail(id, SAMPLE_WEEK(o)) },
    { kind: 'sample-deletion-request', mail: deletionRequestEmail(id, { url: learnerUrl, learnerName: 'Alya', reference: 'KR-7F3A2C', dateLabel: '12 November 2026' }) },
    { kind: 'sample-data-export', mail: dataExportEmail(id, { url: learnerUrl, learnerName: 'Alya', whenLabel: '5 November 2026, 09.30' }) },
    { kind: 'sample-support-confirm', mail: supportConfirmEmail(id, { reference: 'KR-7F3A2C9D', categoryLabel: 'Masalah atau bug' }) },
    {
      kind: 'sample-support-ticket',
      mail: supportTicketEmail(id, {
        reference: 'KR-7F3A2C9D',
        tag: 'Bug',
        categoryLabel: 'Masalah atau bug',
        subject: 'Tombol simpan tidak merespons',
        message: 'Saat saya menekan tombol simpan di halaman jadwal, tidak ada yang terjadi.\nSudah saya coba dua kali di HP.',
        senderEmail: 'orangtua@example.com',
        senderKind: 'akun masuk',
        accountId: '00000000-0000-4000-8000-000000000000',
        accountRole: 'orang tua',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
        screen: '390x844',
        appVersion: '0.1.0',
        whenLabel: '5 November 2026, 09.30',
        pageFrom: '/keluarga',
        attachment: null,
      }),
    },
  ]
}

const SAMPLE_WEEK = (o: string): WeekReportInput => ({
  subject: 'Minggu ini, Alya belajar 4 jam 5 menit',
  weekLabel: '26 Oktober sampai 1 November 2026',
  firstWeekNote: null,
  studyLine: 'Belajar 4 jam 5 menit dalam 5 hari, rata-rata 49 menit sehari.',
  questLine: 'Sesi wajib selesai 9 dari 10.',
  skillsUp: [{ lead: 'Pecahan senilai,', text: 'Math, sekarang 2 bintang' }],
  skillsUpEmpty: '',
  skillsToRepeat: [{ lead: 'Kata kerja lampau,', text: 'English, jawaban benar 3 dari 8' }],
  skillsToRepeatEmpty: '',
  arena: null,
  tutorNote: null,
  nextCompetition: null,
  coach: null,
  reportUrl: `${o}/keluarga`,
  privacyUrl: `${o}/keluarga/privasi`,
  controller: null,
})
