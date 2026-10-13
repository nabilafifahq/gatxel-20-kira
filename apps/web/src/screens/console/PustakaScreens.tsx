'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import type { MistakeReportDTO, PaperLibraryDTO, ProgramActions, ProgramsDTO, SourcesActions, SourcesDTO } from '@/lib/dto-paper'
import { Button, ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { TextField } from '@/components/console/Field'
import { ActionError, EmptyState, InlineAlert } from '@/components/console/Feedback'
import { dateId } from '@/components/console/format'
import { Card, PageHeader, SubjectChip } from '@/components/console/Layout'
import { Tag } from '@/components/console/Tag'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'

/**
 * Pustaka paper (rencana 10 dan 13): empat halaman dengan satu baris tab. Pustaka paper, Buku Salah, Program
 * olimpiade, dan Sumber soal. Pemilih learner di kerangka konsol mengganti ?learner= di halaman yang sama.
 */

type TabKey = 'paper' | 'salah' | 'program' | 'sumber'

const TABS: { key: TabKey; label: string; href: string }[] = [
  { key: 'paper', label: 'Pustaka paper', href: CONSOLE_ROUTES.library },
  { key: 'salah', label: 'Buku Salah', href: CONSOLE_ROUTES.libraryMistakes },
  { key: 'program', label: 'Program olimpiade', href: CONSOLE_ROUTES.libraryProgram },
  { key: 'sumber', label: 'Sumber soal', href: CONSOLE_ROUTES.librarySources },
]

function Frame({ shell, current, title, description, actions, children }: { shell: PaperLibraryDTO['shell']; current: TabKey; title: string; description: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const learner = shell.currentLearnerId ? `?learner=${encodeURIComponent(shell.currentLearnerId)}` : ''
  return (
    <ConsoleShell shell={shell} active="library">
      <div className="flex flex-col gap-6">
        <nav aria-label="Bagian pustaka" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`${t.href}${learner}`}
              aria-current={t.key === current ? 'page' : undefined}
              className={cx(
                'inline-flex h-10 items-center rounded-pill border-2 px-4 text-small font-bold no-underline',
                t.key === current ? 'border-fg bg-fg text-white' : 'border-border bg-surface text-fg hover:border-fg',
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <PageHeader title={title} description={description} actions={actions} />
        {children}
      </div>
    </ConsoleShell>
  )
}

const ORIGIN_LABEL = { official: 'Paper asli', 'kira-made': 'Paper gaya lomba buatan Kira' } as const

// ---------------------------------------------------------------------------
// Pustaka paper

export function PaperLibraryScreen({ data }: { data: PaperLibraryDTO }) {
  const grade = data.learner?.grade
  return (
    <Frame
      shell={data.shell}
      current="paper"
      title="Pustaka paper"
      description="Bagian paper lomba milik keluarga. Paper harian dipilih dari sini: bagian yang belum dikerjakan, lomba bergiliran, tahun 2021 ke atas lebih dulu, dan paper penuh di hari Sabtu."
      actions={
        <ButtonLink href={CONSOLE_ROUTES.import} variant="secondary" icon="import">
          Impor paket resmi
        </ButtonLink>
      }
    >
      <Card as="section" aria-label="Paper gaya lomba buatan Kira" className="flex flex-col gap-3">
        <h2 className="m-0 text-h3 font-bold">{ORIGIN_LABEL['kira-made']}</h2>
        <p className="m-0 text-body text-fg-muted">
          Dipakai saat pustaka tipis atau semua bagian sudah dikerjakan. Dirakit dari soal olimpiade yang sudah ada dan draf AI yang sudah kamu setujui di Studio AI. Selalu diberi label di layar Syakira sebagai latihan buatan Kira, bukan paper asli.
        </p>
        {data.learner ? (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {data.kiraMade.map((k) => (
              <li key={k.subject} className="inline-flex items-center gap-2">
                <SubjectChip subject={k.subject} size="sm" />
                <span className="text-small tabular">{k.items} soal tersedia untuk Grade {grade}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card as="section" aria-label="Paper di pustaka" className="flex flex-col gap-3">
        <h2 className="m-0 text-h3 font-bold">Paper di pustaka</h2>
        {data.entries.length === 0 ? (
          <EmptyState
            compact
            icon="import"
            title="Belum ada paper di pustaka."
            body="Isi data paper (lomba, tahun, bagian) saat mengimpor PDF atau di halaman paket, lalu setujui soalnya. Paper harian sementara memakai Paper gaya lomba buatan Kira."
          />
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {data.entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-divider py-2.5 last:border-b-0">
                <span className="min-w-0 flex-[1_1_240px] text-body font-bold [overflow-wrap:anywhere]">{e.title}</span>
                <SubjectChip subject={e.subject} size="sm" />
                <span className="text-small tabular">Grade {e.grade}</span>
                <span className="text-small tabular">{e.items} soal, {e.minutes} menit</span>
                <span className="min-w-0 max-w-[260px] truncate text-small text-fg-muted" title={e.source}>
                  {e.source}
                </span>
                {data.learner ? <Tag tone={e.picked ? 'neutral' : 'success'}>{e.picked ? 'Sudah dikerjakan' : 'Belum dikerjakan'}</Tag> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {data.learner ? (
        <Card as="section" aria-label={`Paper ${data.learner.name}`} className="flex flex-col gap-3">
          <h2 className="m-0 text-h3 font-bold">Paper yang sudah keluar untuk {data.learner.name}</h2>
          {data.picks.length === 0 ? (
            <p className="m-0 text-body text-fg-muted">Belum ada paper harian yang dipilih.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {data.picks.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-divider py-2.5 last:border-b-0">
                  <span className="w-28 flex-none text-small tabular">{dateId(p.date, true)}</span>
                  <SubjectChip subject={p.subject} size="sm" />
                  <span className="min-w-0 flex-[1_1_220px] text-body font-semibold [overflow-wrap:anywhere]">{p.origin === 'kira-made' ? `${ORIGIN_LABEL['kira-made']}, ${p.kind === 'full' ? 'penuh' : 'mini'}` : p.title}</span>
                  <span className="text-small tabular">{p.minutes} menit</span>
                  <span className="text-small">{p.result ?? 'Belum ada hasil'}</span>
                  {p.medal ? <Tag tone="success">{p.medal}</Tag> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card as="section" aria-label="Batas medali" className="flex flex-col gap-3">
        <h2 className="m-0 text-h3 font-bold">Batas medali per lomba dan tahun</h2>
        {data.medals.length === 0 ? (
          <p className="m-0 text-body text-fg-muted">
            Belum ada batas medali yang diketahui dan punya sumber, jadi hasil paper belum dibandingkan dengan medali. Tambahkan di content/competitions/medals.json bila penyelenggara menerbitkannya.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {data.medals.map((m) => (
              <li key={`${m.competition}-${m.year}-${m.grades}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-divider py-2.5 last:border-b-0">
                <span className="w-32 flex-none text-body font-bold">{m.competition.toUpperCase()} {m.year}</span>
                <span className="text-small">{m.grades}</span>
                <span className="min-w-0 flex-[1_1_240px] text-small">{m.bands}</span>
                <Tag tone={m.verified ? 'success' : 'warn'}>{m.verified ? 'Terverifikasi' : 'Belum diverifikasi'}</Tag>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Frame>
  )
}

// ---------------------------------------------------------------------------
// Buku Salah (laporan tutor)

export function MistakeReportScreen({ data }: { data: MistakeReportDTO }) {
  return (
    <Frame
      shell={data.shell}
      current="salah"
      title="Buku Salah"
      description="Jawaban salah dan kosong dari Tes dan Paper dikumpulkan otomatis. Setiap Sabtu Syakira mengulangnya di Fix-it Book. Soal keluar dari daftar setelah dijawab benar lagi."
    >
      {!data.learner ? (
        <EmptyState compact icon="learners" title="Belum ada learner." body="Tambahkan learner di halaman Learner." />
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <Card className="flex min-w-[180px] flex-[1_1_180px] flex-col gap-1">
              <span className="text-small font-bold text-fg-muted">Soal menunggu diulang</span>
              <span className="text-h1 font-bold tabular">{data.open}</span>
            </Card>
            <Card className="flex min-w-[180px] flex-[1_1_180px] flex-col gap-1">
              <span className="text-small font-bold text-fg-muted">Dibenahi 30 hari terakhir</span>
              <span className="text-h1 font-bold tabular">{data.cleared}</span>
            </Card>
          </div>

          <Card as="section" aria-label="Jenis kesalahan" className="flex flex-col gap-3">
            <h2 className="m-0 text-h3 font-bold">Jenis kesalahan yang paling sering</h2>
            {data.byType.length === 0 ? (
              <p className="m-0 text-body text-fg-muted">Belum ada kesalahan terbuka. Buku Salah terisi setelah Tes atau Paper dikumpulkan.</p>
            ) : (
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {data.byType.map((t) => (
                  <li key={t.type} className="flex flex-col gap-1 border-b border-divider pb-3 last:border-b-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <strong className="text-body">{t.label}</strong>
                      <Tag>{t.count} soal</Tag>
                      <span className="text-small tabular text-fg-muted">{t.percent} persen</span>
                    </div>
                    <p className="m-0 text-small text-fg-muted">{t.advice}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {data.bySkill.length > 0 ? (
            <Card as="section" aria-label="Skill yang sering salah" className="flex flex-col gap-3">
              <h2 className="m-0 text-h3 font-bold">Skill yang paling sering salah</h2>
              <ul className="m-0 flex list-none flex-col p-0">
                {data.bySkill.map((s) => (
                  <li key={s.skillId} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-divider py-2 last:border-b-0">
                    <SubjectChip subject={s.subject} size="sm" />
                    <span className="min-w-0 flex-[1_1_220px] text-body font-semibold">{s.title}</span>
                    <span className="text-small tabular">{s.count} soal</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {data.items.length > 0 ? (
            <Card as="section" aria-label="Soal terbuka" className="flex flex-col gap-3">
              <h2 className="m-0 text-h3 font-bold">Soal yang menunggu</h2>
              <ul className="m-0 flex list-none flex-col p-0">
                {data.items.map((i) => (
                  <li key={i.ref} className="flex flex-col gap-1 border-b border-divider py-2.5 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SubjectChip subject={i.subject} size="sm" />
                      <span className="text-small font-bold">{i.skillTitle}</span>
                      <Tag>{i.typeLabel}</Tag>
                      <span className="text-small text-fg-muted">Salah {i.wrongOn}</span>
                    </div>
                    <p className="m-0 text-body [overflow-wrap:anywhere]">{i.prompt}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {data.redo.length > 0 ? (
            <Card as="section" aria-label="Sesi ulang" className="flex flex-col gap-2">
              <h2 className="m-0 text-h3 font-bold">Sesi ulang terakhir</h2>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {data.redo.map((r) => (
                  <li key={r.date}>
                    <Tag>{dateId(r.date)}: {r.correct} dari {r.total} benar</Tag>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      )}
    </Frame>
  )
}

// ---------------------------------------------------------------------------
// Program olimpiade

export function ProgramsScreen({ data, actions }: { data: ProgramsDTO; actions: ProgramActions }) {
  return (
    <Frame
      shell={data.shell}
      current="program"
      title="Program olimpiade"
      description="Pilih program dan tanggal mulai. Kira mengisi skill Latihan dan Tes setiap hari di Rencana sesuai minggu programnya. Hari istirahat dilewati."
    >
      {!data.learner ? (
        <EmptyState compact icon="learners" title="Belum ada learner." body="Tambahkan learner di halaman Learner." />
      ) : (
        <>
          {data.programs.length === 0 ? (
            <EmptyState compact icon="plan" title={`Belum ada program untuk Grade ${data.learner.grade}.`} body="Program tersedia untuk Grade 2 (Math, English, Science)." />
          ) : null}
          {data.programs.map((p) => (
            <ProgramCard key={p.id} program={p} learner={data.learner!} minStart={data.minStart} actions={actions} running={data.runs.some((r) => r.programId === p.id && r.status === 'active')} />
          ))}
          {data.runs.length > 0 ? <RunList runs={data.runs} actions={actions} /> : null}
        </>
      )}
    </Frame>
  )
}

function ProgramCard({ program: p, learner, minStart, actions, running }: { program: ProgramsDTO['programs'][number]; learner: NonNullable<ProgramsDTO['learner']>; minStart: string; actions: ProgramActions; running: boolean }) {
  const toast = useToast()
  const start = useAction(actions.startProgram)
  const [date, setDate] = useState(minStart)
  const [dateError, setDateError] = useState<string | undefined>()
  const [done, setDone] = useState<string | null>(null)

  async function submit() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < minStart) {
      setDateError(`Pilih tanggal mulai ${dateId(minStart)} atau sesudahnya.`)
      return
    }
    setDateError(undefined)
    const r = await start.run({ learnerId: learner.id, programId: p.id, startDate: date })
    if (r.ok) {
      const x = r.data
      const parts = [`${x.slots} slot masuk Rencana`, x.simulations > 0 ? `${x.simulations} Sabtu simulasi` : 'tanpa Sabtu simulasi (Sabtu minggu terakhir jatuh di hari ringan)']
      if (x.restDaysSkipped > 0) parts.push(`${x.restDaysSkipped} hari istirahat dilewati`)
      if (x.conflictsSkipped > 0) parts.push(`${x.conflictsSkipped} slot dilewati karena sudah ada slot yang sama`)
      if (x.draftWeeks > 0) parts.push(`${x.draftWeeks} minggu masih draf, terbitkan di Rencana`)
      setDone(parts.join('. ') + '.')
      toast({ tone: 'success', title: `Program dimulai untuk ${learner.name}.` })
    }
  }

  return (
    <Card as="section" aria-label={p.title} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <SubjectChip subject={p.subject} size="sm" />
        <h2 className="m-0 text-h3 font-bold">{p.title}</h2>
        {p.competitions.map((c) => (
          <Tag key={c}>{c}</Tag>
        ))}
      </div>
      <p className="m-0 text-body text-fg-muted">{p.summary}</p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {p.phases.map((ph) => (
          <li key={ph.name} className="flex flex-col gap-0.5 rounded-control border border-divider px-3.5 py-2.5">
            <span className="text-body font-bold">
              {ph.weeks}: {ph.name}
            </span>
            <span className="text-small text-fg-muted">{ph.summary}</span>
          </li>
        ))}
      </ol>
      <p className="m-0 text-small text-fg-muted">{p.simulationNote}</p>
      {running ? (
        <InlineAlert tone="info" title="Program ini sedang berjalan.">
          Batalkan yang lama di daftar di bawah kalau ingin memulai ulang dari tanggal lain.
        </InlineAlert>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            id={`mulai-${p.id}`}
            label="Tanggal mulai"
            type="date"
            min={minStart}
            value={date}
            error={dateError}
            onChange={(e) => setDate(e.target.value)}
            fieldClassName="max-w-[220px]"
          />
          <Button variant="primary" icon="plan" loading={start.pending} onClick={submit}>
            Mulai program untuk {learner.name}
          </Button>
        </div>
      )}
      <ActionError error={start.error} />
      {done ? (
        <InlineAlert tone="success" title="Program dimulai.">
          {done}
        </InlineAlert>
      ) : null}
    </Card>
  )
}

function RunList({ runs, actions }: { runs: ProgramsDTO['runs']; actions: ProgramActions }) {
  const toast = useToast()
  const cancel = useAction(actions.cancelProgram)
  return (
    <Card as="section" aria-label="Program yang dijalankan" className="flex flex-col gap-3">
      <h2 className="m-0 text-h3 font-bold">Program yang dijalankan</h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {runs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-divider py-2.5 last:border-b-0">
            <span className="min-w-0 flex-[1_1_260px] text-body font-bold">{r.title}</span>
            <span className="text-small tabular">
              {dateId(r.startDate)} sampai {dateId(r.endDate)}
            </span>
            <span className="text-small tabular">{r.slots} slot</span>
            <Tag tone={r.status === 'active' ? 'success' : 'neutral'}>{r.status === 'active' ? 'Berjalan' : 'Dibatalkan'}</Tag>
            {r.status === 'active' ? (
              <Button
                variant="quiet"
                size="S"
                loading={cancel.pending}
                onClick={async () => {
                  const res = await cancel.run({ runId: r.id })
                  if (res.ok) toast({ tone: 'success', title: 'Program dibatalkan.', body: `${res.data.removed} slot yang belum lewat dihapus dari Rencana.` })
                }}
              >
                Batalkan
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <ActionError error={cancel.error} />
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Sumber soal

export function SourcesScreen({ data, actions }: { data: SourcesDTO; actions: SourcesActions }) {
  const toggle = useAction(actions.setSourceEnabled)
  return (
    <Frame
      shell={data.shell}
      current="sumber"
      title="Sumber soal"
      description="Daftar bank soal yang dikenal Kira. Setiap Minggu dini hari worker mengambil soal baru dari sumber otomatis, membuang yang dobel, memetakan ke skill dan kelas, lalu mengecek kunci jawaban."
    >
      <InlineAlert tone="info" title="Aturan sumber.">
        Hanya lisensi terbuka dan unduhan gratis resmi yang diambil otomatis. Paper berbayar diunggah manual lewat Impor. Soal dengan kunci dari sumber yang sama dengan jawaban AI langsung masuk Bank soal; yang kuncinya buatan AI atau beda masuk antrean Studio AI untuk kamu setujui. Paper resmi tinggal di server keluarga dan tidak masuk repo.
      </InlineAlert>
      {data.weekly.lastRun ? (
        <p className="m-0 text-small text-fg-muted">
          Pengambilan terakhir {dateId(data.weekly.lastRun.slice(0, 10), true)}
          {data.weekly.lastResult ? `: ${data.weekly.lastResult}` : ''}.
        </p>
      ) : (
        <p className="m-0 text-small text-fg-muted">Belum pernah berjalan. Pembaruan pertama menyusul Minggu dini hari berikutnya.</p>
      )}
      <ActionError error={toggle.error} />
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {data.sources.map((s) => (
          <li key={s.id}>
            <Card as="article" aria-label={s.name} className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="m-0 min-w-0 flex-[1_1_260px] text-h3 font-bold [overflow-wrap:anywhere]">{s.name}</h2>
                <Tag tone={s.access === 'auto' ? 'success' : s.access === 'listed' ? 'neutral' : 'warn'}>{s.accessLabel}</Tag>
                <Tag>{s.licenseLabel}</Tag>
                {s.access === 'auto' ? (
                  <Button variant="quiet" size="S" loading={toggle.pending} aria-pressed={s.enabled} onClick={() => toggle.run({ sourceId: s.id, enabled: !s.enabled })}>
                    {s.enabled ? 'Matikan pengambilan' : 'Nyalakan pengambilan'}
                  </Button>
                ) : null}
              </div>
              <p className="m-0 text-small text-fg-muted [overflow-wrap:anywhere]">
                {s.subjects}, {s.grades}, tahun {s.years}.{' '}
                <a href={s.site} rel="noreferrer noopener" target="_blank" className="font-semibold">
                  Situs sumber
                </a>
              </p>
              {s.licenseNote ? <p className="m-0 text-small [overflow-wrap:anywhere]">{s.licenseNote}</p> : null}
              <p className="m-0 text-small text-fg-muted [overflow-wrap:anywhere]">Atribusi: {s.attribution}</p>
              {s.notes ? <p className="m-0 text-small text-fg-muted [overflow-wrap:anywhere]">{s.notes}</p> : null}
              <p className="m-0 flex flex-wrap gap-2 text-small tabular">
                {s.committable ? <Tag>Boleh jadi JSON konten di repo dengan atribusi</Tag> : <Tag>Hanya di server keluarga</Tag>}
                {s.counts.published > 0 ? <Tag tone="success">{s.counts.published} masuk bank</Tag> : null}
                {s.counts.queued > 0 ? <Tag tone="warn">{s.counts.queued} di antrean Studio AI</Tag> : null}
                {s.counts.imported > 0 ? <Tag>{s.counts.imported} PDF masuk Impor</Tag> : null}
                {s.counts.unmapped > 0 ? <Tag>{s.counts.unmapped} belum punya skill</Tag> : null}
                {s.counts.rejected > 0 ? <Tag>{s.counts.rejected} ditolak</Tag> : null}
              </p>
              {s.lastRun ? (
                <p className="m-0 text-small text-fg-muted [overflow-wrap:anywhere]">
                  Terakhir {dateId(s.lastRun.slice(0, 10))}
                  {s.lastResult ? `: ${s.lastResult}` : ''}
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </Frame>
  )
}
