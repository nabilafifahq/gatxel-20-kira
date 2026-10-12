'use client'

import type { PlanSlotDTO, PlannerDTO, Subject } from '@/lib/dto'
import { cx } from './cx'
import { SUBJECT_BG50, SUBJECT_BORDER, SUBJECT_LABEL, SUBJECTS } from './format'
import { ConsoleIcon } from './icons'

/**
 * Grid perencana 7 hari kali 3 mapel (papan WeekPlannerGrid, Perencana).
 * Tidak ada seret: setiap slot punya tombol Ubah dan Pindah, setiap sel kosong punya Tambah.
 * Total per hari dibandingkan dengan batas waktu layar; amber selalu disertai angka dan teks.
 * Layar sempit memakai daftar per hari.
 */

export const MODE_LABEL: Record<PlanSlotDTO['mode'], string> = {
  belajar: 'Belajar',
  latihan: 'Latihan',
  tes: 'Tes',
  kertas: 'Kertas',
}

type Day = PlannerDTO['days'][number]

type GridProps = {
  days: Day[]
  slots: PlanSlotDTO[]
  screenLimitMin: number
  onAdd: (date: string, subject: Subject) => void
  onEdit: (slot: PlanSlotDTO) => void
  onMove: (slot: PlanSlotDTO) => void
  onToggleRest: (date: string, rest: boolean) => void
  restPending: string | null
}

function dayParts(label: string): { dow: string; date: string } {
  // label dari DTO, misalnya "Senin 19 Okt"; pisahkan nama hari dari tanggal
  const i = label.indexOf(' ')
  return i < 0 ? { dow: label, date: '' } : { dow: label.slice(0, i), date: label.slice(i + 1) }
}

function SlotCard({ slot, dayLabel, onEdit, onMove }: { slot: PlanSlotDTO; dayLabel: string; onEdit: () => void; onMove: () => void }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1 rounded-control border border-divider bg-surface p-2">
      <span className={cx('inline-flex h-6 items-center rounded-pill border px-2 text-small leading-5 font-bold', SUBJECT_BG50[slot.subject], SUBJECT_BORDER[slot.subject])}>
        {slot.kind === 'bonus' ? 'Bonus' : MODE_LABEL[slot.mode]}
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Ubah ${slot.title}, ${SUBJECT_LABEL[slot.subject]}, ${dayLabel}`}
        className="min-h-6 max-w-full cursor-pointer border-0 bg-transparent p-0 text-left text-small font-bold break-words text-fg underline decoration-divider decoration-2 underline-offset-3 hover:decoration-fg"
      >
        {slot.title}
      </button>
      <span className="text-small text-fg-muted tabular">
        {slot.questionCount} soal, {slot.minutes} mnt{slot.kind === 'bonus' ? ', opsional' : ''}
      </span>
      <button
        type="button"
        onClick={onMove}
        aria-label={`Pindah ${slot.title}, ${SUBJECT_LABEL[slot.subject]}, ${dayLabel}`}
        className="mt-0.5 inline-flex h-8 cursor-pointer items-center gap-1 rounded-control border border-border bg-surface px-2 text-small font-semibold text-fg hover:border-fg"
      >
        <ConsoleIcon name="move" size={14} strokeWidth={2.5} />
        Pindah
      </button>
    </div>
  )
}

function Cell({
  day,
  subject,
  slots,
  onAdd,
  onEdit,
  onMove,
}: {
  day: Day
  subject: Subject
  slots: PlanSlotDTO[]
  onAdd: () => void
  onEdit: (s: PlanSlotDTO) => void
  onMove: (s: PlanSlotDTO) => void
}) {
  const shown = slots.filter((s) => s.kind !== 'rest')
  if (day.rest) {
    return (
      <div className="flex h-full min-h-24 items-center gap-1.5 rounded-control border border-divider bg-bg px-2.5 text-small font-semibold text-fg-muted">
        <ConsoleIcon name="moon" size={16} />
        Istirahat
      </div>
    )
  }
  return (
    <div className={cx('flex h-full min-h-24 flex-col gap-1.5 rounded-control p-1', shown.length === 0 ? 'border border-dashed border-border bg-surface' : '')}>
      {shown.map((s) => (
        <SlotCard key={s.id} slot={s} dayLabel={day.label} onEdit={() => onEdit(s)} onMove={() => onMove(s)} />
      ))}
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Tambah ${SUBJECT_LABEL[subject]}, ${day.label}`}
        className={cx(
          'inline-flex h-8 cursor-pointer items-center gap-1 self-start rounded-control border-0 bg-transparent px-2 text-small font-semibold text-fg-muted hover:bg-bg hover:text-fg',
          shown.length === 0 && 'my-auto',
        )}
      >
        <ConsoleIcon name="plus" size={14} strokeWidth={2.5} />
        Tambah
      </button>
    </div>
  )
}

function RestToggle({ day, pending, onToggle }: { day: Day; pending: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={day.rest}
      aria-busy={pending || undefined}
      onClick={() => {
        if (!pending) onToggle()
      }}
      aria-label={`Hari istirahat, ${day.label}`}
      className={cx(
        'inline-flex h-8 cursor-pointer items-center gap-1 rounded-control border px-2 text-small font-semibold',
        day.rest ? 'border-fg bg-fg text-white' : 'border-border bg-surface text-fg hover:border-fg',
        pending && 'cursor-progress opacity-70',
      )}
    >
      <ConsoleIcon name={day.rest ? 'check' : 'moon'} size={14} strokeWidth={2.5} />
      Istirahat
    </button>
  )
}

function TotalBadge({ day, limit }: { day: Day; limit: number }) {
  const label = day.rest ? 'Istirahat' : `${day.totalMinutes} mnt`
  const aria = `${day.label}, ${day.rest ? 'hari istirahat' : `${day.totalMinutes} menit`}${day.overLimit ? `, melebihi batas ${limit} menit` : ''}`
  return (
    <div
      aria-label={aria}
      className={cx(
        'flex items-center gap-1 rounded-control bg-surface px-2.5 py-1.5 text-body font-bold tabular',
        day.overLimit ? 'border-2 border-warn text-warn' : 'border border-divider text-fg',
      )}
    >
      {day.overLimit ? <ConsoleIcon name="alert" size={16} strokeWidth={2.5} /> : null}
      {label}
    </div>
  )
}

export function WeekPlannerGrid({ days, slots, screenLimitMin, onAdd, onEdit, onMove, onToggleRest, restPending }: GridProps) {
  const byCell = (date: string, subject: Subject) => slots.filter((s) => s.date === date && s.subject === subject)
  return (
    <>
      {/* Tablet dan layar lebar: tabel 7 hari kali 3 mapel */}
      <div role="region" aria-labelledby="jadwal-cap" tabIndex={0} className="relative overflow-x-auto rounded-card border border-divider bg-surface p-4 max-md:hidden">
        <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-2">
          <caption id="jadwal-cap" className="visually-hidden">
            Jadwal minggu ini, 7 hari kali 3 mapel
          </caption>
          <colgroup>
            <col className="w-[104px]" />
            {days.map((d) => (
              <col key={d.date} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <td />
              {days.map((d) => {
                const p = dayParts(d.label)
                return (
                  <th key={d.date} scope="col" className="px-1 pb-1 text-left align-top font-normal">
                    <span className="block text-small font-semibold text-fg-muted">{p.dow}</span>
                    <span className="block text-body font-bold tabular">{p.date}</span>
                    <span className="mt-1 block">
                      <RestToggle day={d} pending={restPending === d.date} onToggle={() => onToggleRest(d.date, !d.rest)} />
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {SUBJECTS.map((subject) => (
              <tr key={subject}>
                <th scope="row" className="text-left align-middle text-body font-bold">
                  {SUBJECT_LABEL[subject]}
                </th>
                {days.map((d) => (
                  <td key={d.date} className="h-px align-top">
                    <Cell day={d} subject={subject} slots={byCell(d.date, subject)} onAdd={() => onAdd(d.date, subject)} onEdit={onEdit} onMove={onMove} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="border-t border-divider pt-2 text-left text-body font-bold">
                Total
              </th>
              {days.map((d) => (
                <td key={d.date} className="border-t border-divider pt-2">
                  <TotalBadge day={d} limit={screenLimitMin} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* HP: daftar per hari */}
      <ol className="m-0 flex list-none flex-col gap-3 p-0 md:hidden" aria-label="Jadwal minggu ini per hari">
        {days.map((d) => (
          <li key={d.date} className="flex flex-col gap-2.5 rounded-card border border-divider bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="m-0 mr-auto text-body font-bold">{d.label}</h3>
              <TotalBadge day={d} limit={screenLimitMin} />
              <RestToggle day={d} pending={restPending === d.date} onToggle={() => onToggleRest(d.date, !d.rest)} />
            </div>
            {d.rest ? (
              <p className="m-0 flex items-center gap-1.5 text-small font-semibold text-fg-muted">
                <ConsoleIcon name="moon" size={16} />
                Hari istirahat, tidak ada quest.
              </p>
            ) : (
              SUBJECTS.map((subject) => (
                <div key={subject} className="flex flex-col gap-1.5 border-t border-divider pt-2.5">
                  <span className="text-small font-bold">{SUBJECT_LABEL[subject]}</span>
                  <Cell day={d} subject={subject} slots={byCell(d.date, subject)} onAdd={() => onAdd(d.date, subject)} onEdit={onEdit} onMove={onMove} />
                </div>
              ))
            )}
          </li>
        ))}
      </ol>
    </>
  )
}
