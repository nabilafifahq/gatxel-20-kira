'use client'

import Link from 'next/link'
import type { ConsoleShell as ConsoleShellDTO, Subject } from '@/lib/dto'
import { ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { DataTable, type Column } from '@/components/console/DataTable'
import { EmptyState, StatusText } from '@/components/console/Feedback'
import { dateTimeId, num } from '@/components/console/format'
import { typeLabel } from '@/components/console/labels'
import { Card, KeyValues, PageHeader, Section, SectionHeading, SubjectChip } from '@/components/console/Layout'
import { CONSOLE_ROUTES } from '@/components/console/routes'

/**
 * Rincian satu attempt untuk tutor (dibuka dari Riwayat attempt di detail learner):
 * skor, waktu, lalu satu baris per soal dengan jawaban learner dan kuncinya.
 * Jawaban yang menunggu nilai tutor ditautkan ke Kotak hasil.
 */

export type AttemptRowStatus = 'correct' | 'wrong' | 'pending' | 'blank'

export type AttemptDetailDTO = {
  shell: ConsoleShellDTO
  learner: { id: string; name: string }
  attempt: {
    id: string
    title: string
    subject: Subject
    modeLabel: string
    /** Timestamp ISO: waktu dikumpulkan, atau waktu mulai bila belum dikumpulkan. */
    date: string
    submitted: boolean
    statusLabel: string
    score: string
    minutes: number
    counts: Record<AttemptRowStatus, number> & { total: number }
  }
  rows: {
    position: number
    skillTitle: string
    prompt: string
    type: string
    answer: string
    key: string
    status: AttemptRowStatus
    tries: number
    hintsUsed: number
    seconds: number | null
    gradeHref: string | null
  }[]
  backHref: string
}

export type AttemptDetailScreenProps = { data: AttemptDetailDTO }

type Row = AttemptDetailDTO['rows'][number]

function StatusCell({ row }: { row: Row }) {
  if (row.status === 'correct') {
    return <StatusText tone="success">{row.tries > 1 ? 'Benar di percobaan kedua' : 'Benar'}</StatusText>
  }
  if (row.status === 'wrong') return <StatusText tone="warn">Belum tepat</StatusText>
  if (row.status === 'pending') {
    return (
      <span className="flex flex-col items-start gap-0.5">
        <StatusText tone="muted" icon="clock">
          Menunggu nilai
        </StatusText>
        {row.gradeHref ? (
          <Link href={row.gradeHref} className="text-small font-bold">
            Nilai sekarang
          </Link>
        ) : null}
      </span>
    )
  }
  return <span className="font-semibold text-fg-muted">Kosong</span>
}

export function AttemptDetailScreen({ data }: AttemptDetailScreenProps) {
  const { attempt: a, learner } = data
  const c = a.counts
  const columns: Column<Row>[] = [
    { key: 'no', header: 'No.', align: 'right', cell: (r) => r.position, className: 'w-14' },
    {
      key: 'soal',
      header: 'Soal',
      rowHeader: true,
      cell: (r) => (
        <span className="flex min-w-[220px] flex-col gap-0.5 font-normal">
          <span className="text-small font-semibold text-fg-muted">
            {r.skillTitle}, {typeLabel(r.type)}
          </span>
          <span>{r.prompt}</span>
        </span>
      ),
    },
    { key: 'jawaban', header: 'Jawaban learner', cell: (r) => <span className="block min-w-[140px] whitespace-pre-line [overflow-wrap:anywhere]">{r.answer}</span> },
    { key: 'kunci', header: 'Kunci', cell: (r) => <span className="block min-w-[120px] [overflow-wrap:anywhere]">{r.key}</span> },
    { key: 'status', header: 'Status', cell: (r) => <StatusCell row={r} />, className: 'whitespace-nowrap' },
    { key: 'hint', header: 'Hint', align: 'right', cell: (r) => r.hintsUsed },
    { key: 'detik', header: 'Detik', align: 'right', cell: (r) => (r.seconds == null ? 'belum ada' : num(r.seconds)), className: 'whitespace-nowrap' },
  ]

  return (
    <ConsoleShell shell={data.shell} active="learners">
      <nav aria-label="Jejak" className="-mb-4 flex flex-wrap items-center gap-2 text-small text-fg-muted">
        <Link href={CONSOLE_ROUTES.learners} className="font-semibold">
          Learner
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={data.backHref} className="font-semibold">
          {learner.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Rincian attempt</span>
      </nav>

      <PageHeader
        title={a.title}
        description={`${learner.name}, ${a.modeLabel}, ${a.submitted ? 'dikumpulkan' : 'dimulai'} ${dateTimeId(a.date)}.`}
        actions={
          <ButtonLink href={data.backHref} variant="secondary" icon="arrowLeft">
            Kembali ke {learner.name}
          </ButtonLink>
        }
      />

      <Card>
        <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
          <div className="flex flex-col gap-1">
            <span className="text-small font-semibold text-fg-muted">Skor</span>
            <span className="font-display text-h1 leading-10 font-semibold tabular">{a.score}</span>
          </div>
          <KeyValues
            className="min-w-0 flex-[1_1_300px]"
            items={[
              { label: 'Mapel', value: <SubjectChip subject={a.subject} withIcon={false} size="sm" /> },
              { label: 'Status', value: a.statusLabel },
              { label: 'Waktu kerja', value: a.minutes > 0 ? `${a.minutes} menit` : 'Belum tercatat' },
              {
                label: 'Soal',
                value: `${c.total} soal: ${c.correct} benar, ${c.wrong} belum tepat${c.pending ? `, ${c.pending} menunggu nilai` : ''}${c.blank ? `, ${c.blank} kosong` : ''}`,
              },
            ]}
          />
        </div>
      </Card>

      <Section labelledBy="per-soal">
        <SectionHeading id="per-soal" count={c.total} countLabel={`${c.total} soal`}>
          Jawaban per soal
        </SectionHeading>
        {data.rows.length === 0 ? (
          <EmptyState
            compact
            icon="paper"
            title="Attempt ini tidak punya soal."
            body="Soal di attempt ini tidak ditemukan lagi, misalnya soal impor yang sudah dipensiunkan. Skor di atas tetap tersimpan."
          />
        ) : (
          <>
            {/* Layar lebar: tabel. HP: satu kartu per soal supaya jawaban dan kunci terlihat tanpa menggulir ke samping. */}
            <div className="max-md:hidden">
              <DataTable caption={`Jawaban ${learner.name} per soal, ${a.title}`} columns={columns} rows={data.rows} rowKey={(r) => String(r.position)} minWidth={880} />
            </div>
            <ol aria-label={`Jawaban ${learner.name} per soal`} className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
              {data.rows.map((r) => (
                <li key={r.position} className="flex min-w-0 flex-col gap-2 rounded-card border border-divider bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <span className="text-body font-bold">Soal {r.position}</span>
                    <StatusCell row={r} />
                  </div>
                  <span className="text-small font-semibold text-fg-muted">
                    {r.skillTitle}, {typeLabel(r.type)}
                  </span>
                  <p className="m-0 text-body">{r.prompt}</p>
                  <KeyValues
                    className="border-t border-divider pt-2"
                    items={[
                      { label: 'Jawaban', value: <span className="block whitespace-pre-line [overflow-wrap:anywhere]">{r.answer}</span> },
                      { label: 'Kunci', value: <span className="block [overflow-wrap:anywhere]">{r.key}</span> },
                      { label: 'Hint', value: r.hintsUsed },
                      { label: 'Detik', value: r.seconds == null ? 'belum ada' : num(r.seconds) },
                    ]}
                  />
                </li>
              ))}
            </ol>
          </>
        )}
        <p className="m-0 text-small text-fg-muted">
          Kunci jawaban hanya tampil di konsol tutor. Status memakai jawaban terakhir di setiap soal; hint dan detik dijumlah dari semua percobaan.
        </p>
      </Section>
    </ConsoleShell>
  )
}
