'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { AttentionItem, SubjectTodayStatus, TutorTodayDTO } from '@/lib/dto'
import { ButtonLink, Button } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ErrorState, InlineAlert, StatusText } from '@/components/console/Feedback'
import { dateId, num, pct, timeId } from '@/components/console/format'
import { ConsoleIcon, type ConsoleIconName } from '@/components/console/icons'
import { Card, PageHeader, Section, SectionHeading, SubjectChip } from '@/components/console/Layout'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { TrendRows } from '@/components/console/TrendRows'

/**
 * T01 Hari ini (papan TutorHariIni, TutorHariIniHP, TutorHariIniSebagian, TutorHariIniError).
 * Urutan tetap: Perlu perhatian dulu, lalu status quest hari ini per mapel, lalu tren 4 minggu.
 * Setiap bagian punya state sendiri; satu bagian gagal tidak mengosongkan halaman.
 */

export type TutorTodaySectionError = { section: 'attention' | 'today' | 'trend'; reference: string }

export type TutorTodayScreenProps = {
  data: TutorTodayDTO
  /** Bagian yang gagal dimuat. DTO belum punya tempat untuk ini, jadi halaman mengirimnya terpisah. */
  failed?: TutorTodaySectionError[]
}

const KIND_ICON: Record<AttentionItem['kind'], { icon: ConsoleIconName; tone: string }> = {
  'skill-low': { icon: 'trendDown', tone: 'text-warn' },
  'needs-grading': { icon: 'inbox', tone: 'text-fg' },
  registration: { icon: 'trophy', tone: 'text-fg' },
  consent: { icon: 'shield', tone: 'text-fg' },
  sync: { icon: 'sync', tone: 'text-warn' },
  'problem-report': { icon: 'alert', tone: 'text-warn' },
  'ai-draft': { icon: 'sparkle', tone: 'text-fg' },
}

const STATE_LABEL: Record<SubjectTodayStatus['state'], string> = {
  'not-started': 'Belum mulai',
  'in-progress': 'Sedang dikerjakan',
  done: 'Selesai',
  rest: 'Hari istirahat',
  'not-planned': 'Tidak ada quest',
}

function StateCell({ s }: { s: SubjectTodayStatus }) {
  if (s.state === 'done') return <StatusText tone="success">{STATE_LABEL.done}</StatusText>
  if (s.state === 'in-progress') return <span className="font-semibold">{STATE_LABEL['in-progress']}</span>
  if (s.state === 'rest') return <StatusText tone="muted" icon="moon">{STATE_LABEL.rest}</StatusText>
  return <span className="text-fg-muted">{STATE_LABEL[s.state]}</span>
}

function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <ul className="m-0 list-none overflow-hidden rounded-card border border-divider bg-surface p-0 max-sm:flex max-sm:flex-col max-sm:gap-2.5 max-sm:overflow-visible max-sm:border-0 max-sm:bg-transparent">
      {items.map((it) => {
        const k = KIND_ICON[it.kind]
        return (
          <li
            key={it.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-divider px-5 py-4 last:border-b-0 max-sm:flex-col max-sm:items-stretch max-sm:gap-2.5 max-sm:rounded-card max-sm:border max-sm:bg-surface max-sm:px-4 max-sm:py-3.5 max-sm:last:border-b"
          >
            <span className="flex size-10 flex-none items-center justify-center rounded-control border border-divider bg-bg max-sm:hidden">
              <ConsoleIcon name={k.icon} size={22} strokeWidth={k.tone === 'text-warn' ? 2.5 : 2} className={k.tone} />
            </span>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col max-sm:flex-none">
              <span className="text-body font-bold">{it.title}</span>
              <span className="text-body text-fg-muted">{it.detail}</span>
            </div>
            <ButtonLink href={it.href} variant="secondary" className="flex-none max-sm:w-full">
              {it.actionLabel}
            </ButtonLink>
          </li>
        )
      })}
    </ul>
  )
}

function TodayTable({ rows }: { rows: SubjectTodayStatus[] }) {
  return (
    <>
      <div role="region" aria-labelledby="quest-hari-ini-cap" tabIndex={0} className="relative overflow-x-auto rounded-card border border-divider bg-surface max-sm:hidden">
        <table className="w-full min-w-[720px] border-collapse text-body">
          <caption id="quest-hari-ini-cap" className="visually-hidden">
            Status quest hari ini per mapel
          </caption>
          <thead>
            <tr>
              {['Mapel', 'Quest', 'Status'].map((h) => (
                <th key={h} scope="col" className="border-b border-divider px-5 py-3 text-left text-small font-semibold text-fg-muted">
                  {h}
                </th>
              ))}
              {['Dikerjakan', 'Benar', 'Menit', 'Sinkron terakhir'].map((h) => (
                <th key={h} scope="col" className="border-b border-divider px-5 py-3 text-right text-small font-semibold text-fg-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.subject} className="border-b border-divider last:border-b-0">
                <th scope="row" className="px-5 py-3 text-left font-normal">
                  <SubjectChip subject={s.subject} withIcon={false} />
                </th>
                <td className="px-5 py-3">{s.questTitle ?? <span className="text-fg-muted">Belum direncanakan</span>}</td>
                <td className="px-5 py-3">
                  <StateCell s={s} />
                </td>
                <td className="px-5 py-3 text-right tabular">{s.total > 0 ? `${s.answered} dari ${s.total}` : 'tidak ada'}</td>
                <td className={cx('px-5 py-3 text-right tabular', s.accuracy == null && 'text-fg-muted')}>{pct(s.accuracy)}</td>
                <td className="px-5 py-3 text-right tabular">{num(s.minutes)}</td>
                <td className={cx('px-5 py-3 text-right tabular', !s.syncedAt && 'text-fg-muted')}>{s.syncedAt ? timeId(s.syncedAt) : 'belum ada'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* HP: daftar ringkas (papan TutorHariIniHP) */}
      <ul className="m-0 hidden list-none rounded-card border border-divider bg-surface px-4 py-0 max-sm:block">
        {rows.map((s) => (
          <li key={s.subject} className="flex min-h-14 flex-wrap items-center gap-2.5 border-b border-divider py-2 last:border-b-0">
            <SubjectChip subject={s.subject} withIcon={false} size="sm" />
            <StateCell s={s} />
            <span className="ml-auto text-body tabular">{s.total > 0 ? `${s.answered} dari ${s.total}` : 'tidak ada'}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

export function TutorTodayScreen({ data, failed = [] }: TutorTodayScreenProps) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const refresh = () => startRefresh(() => router.refresh())
  const failedAttention = failed.find((f) => f.section === 'attention')
  const failedToday = failed.find((f) => f.section === 'today')
  const failedTrend = failed.find((f) => f.section === 'trend')
  const minutes = data.today.reduce((a, s) => a + s.minutes, 0)
  const lastSync = data.today
    .map((s) => s.syncedAt)
    .filter((x): x is string => Boolean(x))
    .sort()
    .pop()

  return (
    <ConsoleShell shell={data.shell} active="today">
      <PageHeader
        title="Hari ini"
        description={lastSync ? `${data.dateLabel}. Data terakhir masuk pukul ${timeId(lastSync)}.` : `${data.dateLabel}. Belum ada data masuk hari ini.`}
        aside={
          data.learner ? (
            <Link
              href={CONSOLE_ROUTES.learnerDetail(data.learner.id)}
              className="inline-flex h-11 items-center gap-2.5 rounded-pill border border-divider bg-surface pr-4 pl-3 text-body font-bold text-fg no-underline hover:border-fg max-lg:hidden"
            >
              <ConsoleIcon name="learners" size={20} />
              {data.learner.name}, Grade {data.learner.grade}
            </Link>
          ) : null
        }
      />

      {data.learner == null ? (
        <InlineAlert tone="info" title="Belum ada learner di organisasi ini." live="status">
          Tambahkan learner pertama dulu. Quest, rencana, dan laporan muncul di sini setelahnya.{' '}
          <Link href={CONSOLE_ROUTES.learners} className="font-bold">
            Tambah learner
          </Link>
        </InlineAlert>
      ) : null}

      {data.partial.length > 0 ? (
        <InlineAlert
          tone="warn"
          title={data.partial.length === 1 ? data.partial[0] : 'Sebagian data belum masuk.'}
          action={
            <Button variant="secondary" icon="sync" onClick={refresh} loading={refreshing}>
              Muat ulang data
            </Button>
          }
        >
          {data.partial.length > 1 ? (
            <ul className="m-0 list-disc pl-5">
              {data.partial.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            'Angka yang belum lengkap ditandai di halaman ini.'
          )}
        </InlineAlert>
      ) : null}

      <Section labelledBy="perhatian">
        <SectionHeading
          id="perhatian"
          count={!failedAttention && data.attention.length > 0 ? data.attention.length : undefined}
          countLabel={`${data.attention.length} hal`}
        >
          Perlu perhatian
        </SectionHeading>
        {failedAttention ? (
          <ErrorState
            title="Daftar perhatian gagal dimuat."
            body="Bagian lain di halaman ini tetap terbaru. Muat ulang daftar ini, dan catat kode di bawah kalau masih gagal."
            reference={failedAttention.reference}
            onRetry={refresh}
            retrying={refreshing}
            retryLabel="Muat ulang"
          />
        ) : data.attention.length > 0 ? (
          <AttentionList items={data.attention} />
        ) : (
          <Card padding="none" className="flex items-center gap-3.5 p-5" aria-live="polite">
            <ConsoleIcon name="checkCircle" size={28} strokeWidth={2.5} className="text-success" />
            <div className="flex flex-col">
              <span className="text-body font-bold">Tidak ada yang perlu perhatian hari ini.</span>
              <span className="text-body text-fg-muted">Quest hari ini berjalan sesuai rencana.</span>
            </div>
          </Card>
        )}
      </Section>

      <Section labelledBy="quest-hari-ini">
        <SectionHeading
          id="quest-hari-ini"
          aside={<span className="text-body text-fg-muted tabular max-sm:text-small">Waktu belajar {num(minutes)} menit hari ini</span>}
        >
          Quest hari ini
        </SectionHeading>
        {failedToday ? (
          <ErrorState
            title="Status quest hari ini gagal dimuat."
            body="Muat ulang bagian ini. Kalau masih gagal, catat kode di bawah."
            reference={failedToday.reference}
            onRetry={refresh}
            retrying={refreshing}
            retryLabel="Muat ulang"
          />
        ) : data.today.length === 0 ? (
          <Card>
            <p className="m-0 text-body font-bold">Belum ada quest untuk hari ini.</p>
            <p className="m-0 text-body text-fg-muted">
              Quest muncul setelah rencana minggu ini terbit. <Link href={CONSOLE_ROUTES.plan}>Buka rencana</Link>
            </p>
          </Card>
        ) : (
          <TodayTable rows={data.today} />
        )}
      </Section>

      <Section labelledBy="tren">
        <SectionHeading id="tren">Tren akurasi 4 minggu</SectionHeading>
        {failedTrend ? (
          <ErrorState
            title="Tren akurasi gagal dimuat."
            body="Muat ulang bagian ini. Kalau masih gagal, catat kode di bawah."
            reference={failedTrend.reference}
            onRetry={refresh}
            retrying={refreshing}
            retryLabel="Muat ulang"
          />
        ) : data.trend.length === 0 ? (
          <Card>
            <p className="m-0 text-body font-bold">Belum ada jawaban untuk dihitung.</p>
            <p className="m-0 text-body text-fg-muted">Tren muncul setelah satu minggu quest selesai.</p>
          </Card>
        ) : (
          <>
            <Card padding="none" className="px-6 py-2 max-sm:px-4">
              <TrendRows trend={data.trend} caption="Akurasi per mapel per minggu, empat minggu terakhir" />
            </Card>
            <p className="m-0 text-small text-fg-muted">
              {data.trend[0]?.points.map((p) => p.label).join(', ')}: empat minggu terakhir, kolom terakhir minggu ini. Akurasi dihitung dari jawaban
              pertama, tanpa hint. Garis putus-putus menandai batas 70%.
            </p>
          </>
        )}
      </Section>

      {data.upcoming.length > 0 ? (
        <Section labelledBy="lomba-berikutnya">
          <SectionHeading id="lomba-berikutnya" aside={<Link href={CONSOLE_ROUTES.competitions} className="text-body font-bold">Buka kalender lomba</Link>}>
            Lomba berikutnya
          </SectionHeading>
          <ul className="m-0 list-none rounded-card border border-divider bg-surface p-0">
            {data.upcoming.map((u) => (
              <li key={`${u.name}-${u.date}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-divider px-5 py-3.5 last:border-b-0 max-sm:px-4">
                <ConsoleIcon name="trophy" size={20} />
                <span className="min-w-0 flex-[1_1_220px] text-body font-bold">{u.name}</span>
                <span className="text-body tabular">
                  {dateId(u.date)}, {u.daysToGo === 0 ? 'hari ini' : `${u.daysToGo} hari lagi`}
                </span>
                {u.registrationClose ? (
                  <span className="w-full pl-9 text-small text-fg-muted max-sm:pl-0">Pendaftaran tutup {dateId(u.registrationClose)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <p className="visually-hidden" aria-live="polite">
        {refreshing ? 'Memuat ulang data' : ''}
      </p>
    </ConsoleShell>
  )
}
