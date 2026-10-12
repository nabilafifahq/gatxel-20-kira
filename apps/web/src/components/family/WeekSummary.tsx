import type { WeekSummaryDTO } from '@/lib/dto'
import { dateId } from '@/components/console/format'
import { ConsoleIcon, StarGlyph } from '@/components/console/icons'
import { cx } from '@/components/console/cx'
import { questLine, starsLine, studyLine, SUBJECT_NAME } from './summaryText'

/**
 * Ringkasan minggu untuk orang tua (papan RingkasanMinggu, RingkasanMingguPertama).
 * Dipakai di halaman keluarga (HP) dan sebagai pratinjau di halaman Laporan konsol.
 * Menit per hari tampil sebagai batang dengan angka tertulis, jadi angkanya terbaca tanpa grafik.
 */

function DayBars({ days }: { days: WeekSummaryDTO['minutesPerDay'] }) {
  const max = Math.max(60, ...days.map((d) => d.minutes))
  return (
    <ul aria-label="Menit belajar per hari" className="m-0 grid list-none grid-cols-7 items-end gap-1.5 p-0">
      {days.map((d) => (
        <li key={d.label} className="flex min-w-0 flex-col items-center gap-1" aria-label={`${d.label}, ${d.minutes} menit`}>
          <span className="text-small font-bold tabular" aria-hidden="true">
            {d.minutes}
          </span>
          <span aria-hidden="true" className="flex h-16 w-full max-w-7 items-end rounded-sm bg-bg">
            <span className={cx('w-full rounded-sm', d.minutes > 0 ? 'bg-math' : 'bg-transparent')} style={{ height: `${Math.round((d.minutes / max) * 100)}%` }} />
          </span>
          <span className="text-small text-fg-muted" aria-hidden="true">
            {d.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function WeekSummary({ summary: s, compact, headingLevel = 2 }: { summary: WeekSummaryDTO; compact?: boolean; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? 'h2' : 'h3'
  const hcls = cx('m-0 font-bold', compact ? 'text-body-lg' : 'text-h3')
  return (
    <div className="flex flex-col gap-[22px]">
      {s.firstWeek ? (
        <div role="status" className="rounded-control border-2 border-math bg-math-50 px-4 py-3.5 text-body">
          Ini minggu pertama {s.learnerName} di Kira. Ringkasan lengkap muncul Senin depan, setelah 7 hari data.
        </div>
      ) : null}

      <section aria-label="Ringkasan" className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-4">
        <div className="flex items-start gap-3">
          <ConsoleIcon name="clock" size={22} className="mt-0.5" />
          <p className="m-0 text-body font-semibold">{studyLine(s)}</p>
        </div>
        <div className="flex items-start gap-3">
          <StarGlyph size={22} className="mt-0.5" />
          <p className="m-0 text-body font-semibold">{questLine(s)}</p>
        </div>
        {s.minutesPerDay.length > 0 ? <DayBars days={s.minutesPerDay} /> : null}
      </section>

      <section aria-labelledby="ws-naik" className="flex flex-col gap-2.5">
        <H id="ws-naik" className={hcls}>
          Naik minggu ini
        </H>
        <ul className="m-0 list-none rounded-card border border-divider bg-surface px-4 py-0">
          {s.skillsUp.length === 0 ? (
            <li className="py-3.5 text-body text-fg-muted">{s.firstWeek ? 'Belum ada pembanding. Minggu ini menjadi titik awal.' : 'Belum ada skill yang naik bintang minggu ini.'}</li>
          ) : (
            s.skillsUp.map((u) => (
              <li key={`${u.subject}-${u.title}`} className="flex items-start gap-3 border-b border-divider py-3 last:border-b-0">
                <ConsoleIcon name="trendUp" size={20} strokeWidth={2.5} className="mt-0.5 text-success" />
                <div className="flex flex-col">
                  <span className="text-body font-bold">{u.title}</span>
                  <span className="text-small text-fg-muted">
                    {SUBJECT_NAME[u.subject]}, {starsLine(u.stars)}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section aria-labelledby="ws-ulang" className="flex flex-col gap-2.5">
        <H id="ws-ulang" className={hcls}>
          Perlu diulang
        </H>
        <ul className="m-0 list-none rounded-card border border-divider bg-surface px-4 py-0">
          {s.skillsToRepeat.length === 0 ? (
            <li className="py-3.5 text-body text-fg-muted">{s.firstWeek ? 'Belum ada. Datanya belum sampai satu minggu.' : 'Tidak ada skill yang perlu diulang minggu ini.'}</li>
          ) : (
            s.skillsToRepeat.map((d) => (
              <li key={`${d.subject}-${d.title}`} className="flex items-start gap-3 border-b border-divider py-3 last:border-b-0">
                <ConsoleIcon name="history" size={20} strokeWidth={2.5} className="mt-0.5 text-warn" />
                <div className="flex flex-col">
                  <span className="text-body font-bold">{d.title}</span>
                  <span className="text-small text-fg-muted">
                    {SUBJECT_NAME[d.subject]}, {d.note}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {s.tutorNote ? (
        <section aria-labelledby="ws-catatan" className="flex flex-col gap-2.5">
          <H id="ws-catatan" className={hcls}>
            Catatan tutor
          </H>
          <blockquote className="m-0 rounded-card border border-divider bg-surface px-4 py-3.5">
            <p className="m-0 text-body whitespace-pre-line">{s.tutorNote}</p>
          </blockquote>
        </section>
      ) : null}

      {s.nextCompetition ? (
        <section aria-labelledby="ws-lomba" className="flex flex-col gap-2.5">
          <H id="ws-lomba" className={hcls}>
            Lomba berikutnya
          </H>
          <div className="flex items-start gap-3 rounded-card border border-divider bg-surface px-4 py-3">
            <ConsoleIcon name="trophy" size={20} className="mt-0.5" />
            <div className="flex flex-col">
              <span className="text-body font-bold">{s.nextCompetition.name}</span>
              <span className="text-small text-fg-muted">{dateId(s.nextCompetition.date, true)}</span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
