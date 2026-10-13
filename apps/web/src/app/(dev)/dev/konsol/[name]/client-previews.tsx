'use client'

import { useEffect, type ReactNode } from 'react'
import { TutorTodayScreen } from '@/screens/console/TutorTodayScreen'
import { tutorToday, tutorTodayAllClear, tutorTodayEmpty, tutorTodayPartial } from '@/dev/fixtures/console-today'
import { LearnerDetailScreen } from '@/screens/console/LearnerDetailScreen'
import { learnerDetail, learnerDetailNew } from '@/dev/fixtures/console-learner'
import { fake } from '@/dev/fixtures/console-shared'
import { PlannerScreen } from '@/screens/console/PlannerScreen'
import { planner, plannerEmpty, plannerPublished } from '@/dev/fixtures/console-planner'
import { PaperBuilderScreen } from '@/screens/console/PaperBuilderScreen'
import { itemBankEmpty, itemBankFor, paperBuilder, paperBuilderNew } from '@/dev/fixtures/console-bank'
import { ItemBankScreen } from '@/screens/console/ItemBankScreen'
import { CompetitionCalendarScreen } from '@/screens/console/CompetitionCalendarScreen'
import { competitions, competitionsEmpty } from '@/dev/fixtures/console-competitions'
import { renderWeekSummaryEmail } from '@/components/family/WeekSummaryEmail'
import { FamilyHomeScreen } from '@/screens/family/FamilyHomeScreen'
import { familyHome, familyHomeFirst, privacy, privacyDeleting, privacyWithdrawn, weekSummary, weekSummaryFirst } from '@/dev/fixtures/family'
import { PrivacyScreen } from '@/screens/family/PrivacyScreen'
import { shell as tutorShell } from '@/dev/fixtures/console-shared'
import { LoginScreen } from '@/screens/public/LoginScreen'
import { SetupScreen } from '@/screens/public/SetupScreen'
import { ResetPasswordScreen } from '@/screens/public/ResetPasswordScreen'
import { AcceptInviteScreen } from '@/screens/public/AcceptInviteScreen'
import { RegisterDeviceScreen } from '@/screens/public/RegisterDeviceScreen'
import { ErrorScreen } from '@/screens/public/ErrorScreen'
import { DEVICE_LEARNERS, INVITE } from '@/dev/fixtures/public'
import { ReportScreen } from '@/screens/console/ReportScreen'
import { JSON_EXPORT, report, reportNoSmtp } from '@/dev/fixtures/console-report'
import { SettingsScreen } from '@/screens/console/SettingsScreen'
import { settings, settingsNoEmail } from '@/dev/fixtures/console-settings'
import { StudioAiScreen } from '@/screens/console/StudioAiScreen'
import { studioAi, studioAiLimited, studioAiNotReady } from '@/dev/fixtures/console-studio'
import { InboxScreen } from '@/screens/console/InboxScreen'
import { inboxEmpty, inboxFor, toneWavUrl } from '@/dev/fixtures/console-inbox'
import { LjkScreen } from '@/screens/console/LjkScreen'
import { ljkEmpty, ljkFor } from '@/dev/fixtures/console-ljk'
import { ImportScreen } from '@/screens/console/ImportScreen'
import { importEmpty, importList, importReview } from '@/dev/fixtures/console-import'
import { LearnersScreen } from '@/screens/console/LearnersScreen'
import { learners, learnersEmpty, learnersFull } from '@/dev/fixtures/console-learners'
import { ClaudeConnectionScreen } from '@/screens/console/ClaudeConnectionScreen'
import { claudeConnected, claudeError, claudeNotConfigured } from '@/dev/fixtures/console-claude'

/**
 * Pratinjau layar client. Action palsu dibuat di sini (fungsi tidak bisa dikirim
 * dari halaman server ke komponen client).
 */

type Params = Record<string, string | undefined>
type Render = (state: string, params: Params) => ReactNode

const PREVIEWS: Record<string, Render> = {
  'hari-ini': (state) => {
    if (state === 'beres') return <TutorTodayScreen data={tutorTodayAllClear} />
    if (state === 'sebagian') return <TutorTodayScreen data={tutorTodayPartial} />
    if (state === 'kosong') return <TutorTodayScreen data={tutorTodayEmpty} />
    if (state === 'error') return <TutorTodayScreen data={{ ...tutorToday, attention: [] }} failed={[{ section: 'attention', reference: 'DEV-0001' }]} />
    return <TutorTodayScreen data={tutorToday} />
  },
  'detail-learner': (state) => (
    <LearnerDetailScreen
      data={state === 'baru' ? learnerDetailNew : learnerDetail}
      actions={{ addNote: fake(undefined, state === 'error', 'Catatan belum tersimpan.') }}
    />
  ),
  rencana: (state) => {
    const fail = state === 'error'
    return (
      <PlannerScreen
        data={state === 'terbit' ? plannerPublished : state === 'kosong' ? plannerEmpty : planner}
        actions={{
          upsertSlot: fake(undefined, fail, 'Slot belum tersimpan.'),
          moveSlot: fake(undefined, fail, 'Slot belum pindah.'),
          deleteSlot: fake(undefined, fail, 'Slot belum terhapus.'),
          setRestDay: fake(undefined, fail, 'Hari istirahat belum tersimpan.'),
          applySuggestions: fake(undefined, fail, 'Usulan belum diterapkan.'),
          publishWeek: fake(undefined, fail, 'Rencana belum terbit.'),
        }}
      />
    )
  },
  paper: (state) => {
    const fail = state === 'error'
    return (
      <PaperBuilderScreen
        data={state === 'baru' ? paperBuilderNew : paperBuilder}
        actions={{
          savePaper: fake({ paperId: 'paper-w02-m-p7' }, fail, 'Paper belum tersimpan.'),
          generatePaper: fake({ itemRefs: ['KRA-M-0531', 'KRA-M-0532', 'KRA-M-0525', 'KRA-M-0522', 'KRA-M-0398', 'KRA-M-0527', 'KRA-M-0523', 'KRA-M-0524', 'KRA-M-0521', 'KRA-M-0526'] }, fail, 'Soal belum terpilih.'),
          assignPaper: fake(undefined, fail, 'Paper belum masuk rencana.'),
          deletePaper: fake(undefined, fail, 'Paper belum terhapus.'),
        }}
      />
    )
  },
  hasil: (state, params) => {
    const fail = state === 'error'
    const filter = params.filter === 'graded' || state === 'selesai' ? 'graded' : 'waiting'
    const respon = params.respon ?? (state === 'saran-ai' ? 'r-w1' : state === 'audio' ? 'r-s1' : state === 'gambar' ? 'r-d1' : undefined)
    const data = state === 'kosong' ? inboxEmpty() : inboxFor(filter, respon, { audioUrl: toneWavUrl() })
    return (
      <InboxScreen
        data={data}
        actions={{
          grade: fake(undefined, fail, 'Nilai belum tersimpan.'),
          requestAiSuggestion: fake(undefined, fail, 'Permintaan saran nilai belum terkirim.'),
        }}
      />
    )
  },
  ljk: (state, params) => (
    <LjkScreen
      data={state === 'kosong' ? ljkEmpty : ljkFor(params.lembar)}
      actions={{ saveLjk: fake({ score: '27 dari 40' }, state === 'error', 'Jawaban LJK belum tersimpan.') }}
    />
  ),
  'bank-soal': (state, params) => <ItemBankScreen data={state === 'kosong' ? itemBankEmpty() : itemBankFor(params)} />,
  lomba: (state) => {
    const fail = state === 'error'
    return (
      <CompetitionCalendarScreen
        data={state === 'kosong' ? competitionsEmpty : competitions}
        actions={{
          saveEvent: fake(undefined, fail, 'Lomba belum tersimpan.'),
          setStatus: fake(undefined, fail, 'Status belum tersimpan.'),
          deleteEvent: fake(undefined, fail, 'Lomba belum terhapus.'),
        }}
      />
    )
  },
  laporan: (state) => (
    <ReportScreen
      data={state === 'tanpa-smtp' ? reportNoSmtp : report}
      actions={{
        sendReport: fake(undefined, state === 'error', 'Laporan belum terkirim.'),
        exportJson: fake({ filename: 'kira-2026-W42.json', json: JSON_EXPORT }, state === 'error', 'JSON belum bisa dibuat.'),
      }}
    />
  ),
  pengaturan: (state) => {
    const fail = state === 'error'
    return (
      <>
        <SettingsScreen
          data={state === 'error' ? settingsNoEmail : settings}
          actions={{
            updateLearnerLimits: fake(undefined, fail, 'Batas belum tersimpan.'),
            revokeDevice: fake(undefined, fail, 'Perangkat belum dicabut.'),
            renameDevice: fake(undefined, fail, 'Nama perangkat belum berubah.'),
            registerThisDevice: fake(undefined, fail, 'Perangkat belum terdaftar.'),
            removePasskey: fake(undefined, fail, 'Passkey belum terhapus.'),
            inviteMember: fake({ link: 'https://kira-rumah.test/undangan/9f2c7a1e' }, fail, 'Undangan belum dibuat.'),
            revokeInvite: fake(undefined, fail, 'Undangan belum dibatalkan.'),
            changePassword: fake(undefined, fail, 'Password belum diganti.'),
          }}
          registerPasskey={fake(undefined, fail, 'Passkey belum tersimpan.')}
        />
        {state === 'cabut' ? <ClickOnMount label="Cabut Tablet Alya" /> : null}
      </>
    )
  },
  'studio-ai': (state) => {
    const fail = state === 'error'
    return (
      <StudioAiScreen
        data={state === 'batas' ? studioAiLimited : state === 'belum-siap' ? studioAiNotReady : studioAi}
        actions={{
          requestDrafts: fake(undefined, fail, 'Permintaan draf belum masuk antrean.'),
          approveDraft: fake({ ref: 'KRA-M-0461' }, fail, 'Draf belum disetujui.'),
          rejectDraft: fake(undefined, fail, 'Draf belum ditolak.'),
        }}
      />
    )
  },
  impor: (state, params) => {
    const fail = state === 'error'
    const data = params.paket ? importReview : state === 'daftar' ? importList : state === 'kosong' ? importEmpty : importReview
    return (
      <ImportScreen
        data={data}
        actions={{
          uploadPdf: fake({ batchId: 'imp-0005' }, fail, 'PDF belum terunggah.'),
          updateImportItem: fake(undefined, fail, 'Perubahan soal belum tersimpan.'),
          approveImportItems: fake({ created: 7 }, fail, 'Soal belum masuk Bank soal.'),
          updateImportMeta: fake(undefined, fail, 'Data paper belum tersimpan.'),
          attachFigure: fake({ url: '/api/media/00000000-0000-4000-8000-000000000001' }, fail, 'Gambar belum terpasang.'),
          removeFigure: fake(undefined, fail, 'Gambar belum dilepas.'),
        }}
      />
    )
  },
  learner: (state) => {
    const fail = state === 'error'
    return (
      <>
        <LearnersScreen
          data={state === 'penuh' ? learnersFull : state === 'kosong' ? learnersEmpty : learners}
          actions={{
            addLearner: fake({ learnerId: 'lrn_seed_new', inviteLink: 'https://kira-rumah.test/persetujuan/4b7e91c2' }, fail, 'Learner belum tersimpan.'),
            updateLearner: fake(undefined, fail, 'Data learner belum tersimpan.'),
            resetPin: fake(undefined, fail, 'PIN baru belum tersimpan.'),
            unlockLearner: fake(undefined, fail, 'Kunci PIN belum dibuka.'),
            recordOfflineConsent: fake(undefined, fail, 'Persetujuan belum tercatat.'),
          }}
        />
        {state === 'tambah' ? <ClickOnMount label="Tambah learner" /> : null}
      </>
    )
  },
  'koneksi-claude': (state) => {
    const fail = state === 'error'
    return (
      <ClaudeConnectionScreen
        data={state === 'belum' ? claudeNotConfigured : state === 'error' ? claudeError : claudeConnected}
        actions={{
          testConnection: fake({ detail: 'Claude Code menjawab dalam 2,8 detik dengan model claude-sonnet-5-5.' }, fail, 'Tes koneksi gagal: worker tidak menjawab.'),
          createMcpToken: fake({ token: 'kira_mcp_7Hq2xV9pL4mN8rT1wZ6yB3cD5fG0jK' }, fail, 'Token belum dibuat.'),
          revokeMcpToken: fake(undefined, fail, 'Token belum dicabut.'),
        }}
      />
    )
  },
  'privasi-keluarga': (state) => {
    const fail = state === 'error'
    const data =
      state === 'ditarik' ? privacyWithdrawn : state === 'hapus' ? privacyDeleting : state === 'tutor' ? { ...privacy, shell: tutorShell } : privacy
    return (
      <PrivacyScreen
        data={data}
        actions={{
          setConsent: fake(undefined, fail, 'Persetujuan belum tersimpan.'),
          exportData: fake({ filename: 'kira-alya-2026-10-16.json', json: JSON_EXPORT }, fail, 'File data belum bisa dibuat.'),
          requestDeletion: fake({ reference: 'KRA-DEL-0042', scheduledFor: '2026-11-15' }, fail, 'Permintaan hapus belum tercatat.'),
          cancelDeletion: fake(undefined, fail, 'Pembatalan belum tersimpan.'),
        }}
      />
    )
  },
  masuk: (state) => {
    const fail = state === 'error'
    return (
      <LoginScreen
        next={null}
        notice={state === 'terkunci' ? 'locked' : state === 'reset-selesai' ? 'reset-done' : null}
        passkeySupported={state !== 'tanpa-passkey'}
        passwordLogin={fake({ redirectTo: '/dev/konsol/hari-ini' }, fail, 'Email atau password tidak cocok.')}
        passkeyLogin={fake({ redirectTo: '/dev/konsol/hari-ini' }, fail, 'Passkey tidak dikenali di akun mana pun.')}
        requestReset={fake(undefined, fail, 'Link belum terkirim.')}
      />
    )
  },
  setup: (state) => <SetupScreen createOrg={fake({ redirectTo: '/dev/konsol/hari-ini' }, state === 'error', 'Kode setup tidak cocok atau sudah dipakai.')} />,
  'reset-password': (state) => (
    <ResetPasswordScreen
      token="seed-token"
      valid={state !== 'kedaluwarsa'}
      resetPassword={fake({ redirectTo: '/dev/konsol/masuk?state=reset-selesai' }, state === 'error', 'Password ini pernah bocor di situs lain. Pilih password lain.')}
    />
  ),
  undangan: (state) => (
    <AcceptInviteScreen
      token="seed-invite"
      invite={state === 'kedaluwarsa' ? null : INVITE}
      acceptInvite={fake({ redirectTo: '/dev/konsol/masuk' }, state === 'error', 'Akun belum dibuat.')}
    />
  ),
  'daftar-perangkat': (state) => (
    <RegisterDeviceScreen
      learners={DEVICE_LEARNERS}
      registered={state === 'terdaftar' ? { name: 'Tablet Alya', learnerNames: ['Alya'] } : null}
      registerDevice={fake({ redirectTo: '/dev/konsol/daftar-perangkat?state=terdaftar' }, state === 'error', 'Tablet belum terdaftar.')}
    />
  ),
  error: (state) => {
    const en = state.endsWith('-en')
    const kind = state.replace(/-en$/, '') as '404' | '500' | 'offline' | 'forbidden'
    return (
      <ErrorScreen
        kind={kind}
        lang={en ? 'en-GB' : 'id'}
        reference={kind === '500' ? 'DEV-0001' : kind === '404' ? 'KRA-404-7731' : null}
        homeHref={en ? '/dev/konsol' : '/dev/konsol/hari-ini'}
      />
    )
  },
  ringkasan: (state) => <FamilyHomeScreen data={state === 'pertama' ? familyHomeFirst : familyHome} />,
  'email-laporan': (state) => <EmailPreview state={state} />,
}

/** Untuk state pratinjau yang dimulai dengan dialog terbuka: klik tombol pemicunya setelah tampil. */
function ClickOnMount({ label }: { label: string }) {
  useEffect(() => {
    const t = window.setTimeout(() => {
      const byLabel = document.querySelector<HTMLElement>(`[aria-label="${label}"]`)
      const byText = Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => b.textContent?.trim() === label)
      ;(byLabel ?? byText)?.click()
    }, 200)
    return () => window.clearTimeout(t)
  }, [label])
  return null
}

function EmailPreview({ state }: { state: string }) {
  const mail = renderWeekSummaryEmail(state === 'pertama' ? weekSummaryFirst : weekSummary, {
    reportUrl: 'https://kira-rumah.test/keluarga',
    privacyUrl: 'https://kira-rumah.test/keluarga/privasi',
    controller: 'Kira, dikelola Keluarga Wiratama, Malang',
  })
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-4 p-6">
      <dl className="m-0 grid grid-cols-[80px_1fr] gap-x-3 gap-y-1 text-small">
        <dt className="font-bold text-fg-muted">Subjek</dt>
        <dd className="m-0 font-bold">{mail.subject}</dd>
      </dl>
      {state === 'teks' ? (
        <pre className="m-0 overflow-auto rounded-control border border-divider bg-surface p-4 font-body text-small whitespace-pre-wrap">{mail.text}</pre>
      ) : (
        <iframe title="Pratinjau email laporan" srcDoc={mail.html} sandbox="" className="h-[1300px] w-full rounded-control border border-divider bg-white" />
      )}
    </main>
  )
}

export function ClientPreview({ name, state, params }: { name: string; state: string; params: Params }) {
  const render = PREVIEWS[name]
  if (!render) return <p className="p-8">Pratinjau {name} belum dibuat.</p>
  return <>{render(state, params)}</>
}
