'use client'

import type { PlanSlotDTO, PlannerDay, Subject } from '@/lib/dto'
import { cx } from './cx'
import { SUBJECT_BG50, SUBJECT_BORDER, SUBJECT_LABEL, SUBJECTS } from './format'
import { ConsoleIcon } from './icons'

/**
 * Grid perencana 7 hari kali 3 mapel (papan WeekPlannerGrid, Perencana).
 * Setiap sel berisi sesi wajib (Latihan, Tes, Paper dari template hari atau slot tutor) lalu sesi opsional.
 * Sesi dari template yang belum punya slot ditandai "Otomatis": tombol Atur membuat slot yang menggantikannya.
 * Tidak ada seret: setiap slot punya tombol Ubah dan Pindah, setiap sel punya Tambah.
 * Total per hari dibandingkan dengan batas waktu layar lewat meteran; amber selalu disertai angka dan teks.
 * Layar sempit memakai daftar per hari.
 */

export const MODE_LABEL: Record<PlanSlotDTO['mode'], string> = {
  belajar: 'Belajar',
  latihan: 'Latihan',
  tes: 'Tes',
  kertas: 'Kertas',
}

export const SESSION_LABEL: Record<PlanSlotDTO['session'], string> = {
  latihan: 'Latihan',
  tes: 'Tes',
  paper: 'Paper',
  lesson: 'Pelajaran',
  simulation: 'Simulasi lomba',
  esmo: 'Paket ESMO',
  review: 'Ulang kartu',
  'quick-maths': 'Hitung Cepat',
  knowledge: 'Kuis Pengetahuan',
  'english-skill': 'Tugas English',
  reading: 'Membaca',
}

/** Label pendek di kartu slot: "Paper mini", "Paper penuh", "Tes", dan seterusnya. */
export function slotChip(slot: PlanSlotDTO): string {
  if (slot.mode === 'kertas') return 'Paper kertas'
  if (slot.session === 'paper') return slot.paperKind === 'full' ? 'Paper penuh' : slot.paperKind === 'mini' ? 'Paper mini' : 'Paper'
  return SESSION_LABEL[slot.session]
}

type GridProps = {
  days: PlannerDay[]
  slots: PlanSlotDTO[]
  screenLimitMin: number
  onAdd: (date: string, subject: Subject) => void
  onEdit: (slot: PlanSlotDTO) => void
  onMove: (slot: PlanSlotDTO) => void
  onToggleRest: (date: string, rest: boolean) => void
  onTemplate: (date: string) => void
  restPending: string | null
}

function dayParts(label: string): { dow: string; date: string } {
  // label dari DTO, misalnya "Senin 19 Okt"; pisahkan nama hari dari tanggal
  const i = label.indexOf(' ')
  return i < 0 ? { dow: label, date: '' } : { dow: label.slice(0, i), date: label.slice(i + 1) }
}

function SlotCard({ slot, dayLabel, onEdit, onMove }: { slot: PlanSlotDTO; dayLabel: string; onEdit: () => void; onMove: () => void }) {
  const counted = slot.session === 'latihan' || slot.session === 'tes' || slot.session === 'reading' || slot.session === 'paper'
  return (
    <div className={cx('flex min-w-0 flex-col items-start gap-1 rounded-control border bg-surface p-2', slot.auto ? 'border-dashed border-border' : 'border-divider')}>
      <span className="flex flex-wrap items-center gap-1">
        <span className={cx('inline-flex h-6 items-center rounded-pill border px-2 text-small leading-5 font-bold', SUBJECT_BG50[slot.subject], SUBJECT_BORDER[slot.subject])}>{slotChip(slot)}</span>
        {slot.auto ? <span className="text-small font-semibold text-fg-muted">Otomatis</span> : null}
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${slot.auto ? 'Atur' : 'Ubah'} ${slotChip(slot)}: ${slot.title}, ${SUBJECT_LABEL[slot.subject]}, ${dayLabel}`}
        className="min-h-6 max-w-full cursor-pointer border-0 bg-transparent p-0 text-left text-small font-bold break-words text-fg underline decoration-divider decoration-2 underline-offset-3 hover:decoration-fg"
      >
        {slot.title}
      </button>
      <span className="text-small text-fg-muted tabular">
        {counted && slot.questionCount > 0 ? `${slot.questionCount} soal, ` : ''}
        {slot.minutes} mnt{slot.required ? '' : ', opsional'}
      </span>
      {slot.auto ? null : (
        <button
          type="button"
          onClick={onMove}
          aria-label={`Pindah ${slotChip(slot)}: ${slot.title}, ${SUBJECT_LABEL[slot.subject]}, ${dayLabel}`}
          className="mt-0.5 inline-flex h-8 cursor-pointer items-center gap-1 rounded-control border border-border bg-surface px-2 text-small font-semibold text-fg hover:border-fg"
        >
          <ConsoleIcon name="move" size={14} strokeWidth={2.5} />
          Pindah
        </button>
      )}
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
  day: PlannerDay
  subject: Subject
  slots: PlanSlotDTO[]
  onAdd: () => void
  onEdit: (s: PlanSlotDTO) => void
  onMove: (s: PlanSlotDTO) => void
}) {
  const shown = slots.filter((s) => s.kind !== 'rest')
  const required = shown.filter((s) => s.required)
  const extra = shown.filter((s) => !s.required)
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
      {required.map((s) => (
        <SlotCard key={s.id} slot={s} dayLabel={day.label} onEdit={() => onEdit(s)} onMove={() => onMove(s)} />
      ))}
      {extra.length > 0 ? <span className="px-1 text-small font-bold text-fg-muted">Opsional</span> : null}
      {extra.map((s) => (
        <SlotCard key={s.id} slot={s} dayLabel={day.label} onEdit={() => onEdit(s)} onMove={() => onMove(s)} />
      ))}
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Tambah sesi ${SUBJECT_LABEL[subject]}, ${day.label}`}
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

function RestToggle({ day, pending, onToggle }: { day: PlannerDay; pending: boolean; onToggle: () => void }) {
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

function TemplateButton({ day, onClick }: { day: PlannerDay; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Template ${day.templateLabel}, ${day.label}. Ubah template.`}
      className="inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-control border border-border bg-surface px-2 text-small font-semibold text-fg hover:border-fg"
    >
      <ConsoleIcon name="plan" size={14} strokeWidth={2.5} />
      <span className="truncate">{day.templateLabel}</span>
    </button>
  )
}

/** Meteran waktu layar: sesi wajib penuh, sesi opsional sebagai sambungan, garis tegak di batas orang tua. */
function TotalBadge({ day, limit }: { day: PlannerDay; limit: number }) {
  if (day.rest) {
    return (
      <div aria-label={`${day.label}, hari istirahat`} className="flex items-center gap-1 rounded-control border border-divider bg-surface px-2.5 py-1.5 text-body font-bold text-fg">
        Istirahat
      </div>
    )
  }
  const span = Math.max(limit, day.totalMinutes, 1)
  const reqPct = Math.min(100, (day.requiredMinutes / span) * 100)
  const totalPct = Math.min(100, (day.totalMinutes / span) * 100)
  const limitPct = Math.min(100, (limit / span) * 100)
  const aria = `${day.label}, ${day.totalMinutes} menit dari batas ${limit}, ${day.requiredCount} sesi wajib ${day.requiredMinutes} menit, ${day.extraCount} sesi opsional${day.overLimit ? ', melebihi batas' : ''}`
  return (
    <div role="img" aria-label={aria} className={cx('flex flex-col gap-1.5 rounded-control bg-surface px-2.5 py-1.5', day.overLimit ? 'border-2 border-warn' : 'border border-divider')}>
      <span className={cx('flex items-center gap-1 text-body font-bold tabular', day.overLimit ? 'text-warn' : 'text-fg')}>
        {day.overLimit ? <ConsoleIcon name="alert" size={16} strokeWidth={2.5} /> : null}
        {day.totalMinutes} mnt
      </span>
      <span aria-hidden="true" className="relative flex h-2 overflow-hidden rounded-pill bg-divider">
        <span className="h-full bg-fg-muted" style={{ width: `${totalPct}%` }} />
        <span className="absolute inset-y-0 left-0 bg-fg" style={{ width: `${reqPct}%` }} />
        <span className="absolute inset-y-0 w-0.5 bg-warn" style={{ left: `calc(${limitPct}% - 1px)` }} />
      </span>
      <span aria-hidden="true" className="text-small text-fg-muted tabular">
        {day.requiredCount} wajib{day.extraCount > 0 ? `, ${day.extraCount} opsional` : ''}
      </span>
    </div>
  )
}

export function WeekPlannerGrid({ days, slots, screenLimitMin, onAdd, onEdit, onMove, onToggleRest, onTemplate, restPending }: GridProps) {
  const byCell = (date: string, subject: Subject) => slots.filter((s) => s.date === date && s.subject === subject)
  return (
    <>
      {/* Tablet dan layar lebar: tabel 7 hari kali 3 mapel */}
      <div role="region" aria-labelledby="jadwal-cap" tabIndex={0} className="relative overflow-x-auto rounded-card border border-divider bg-surface p-4 max-md:hidden">
        <table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-2">
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
                    <span className="mt-1 flex flex-col items-start gap-1">
                      {d.rest ? null : <TemplateButton day={d} onClick={() => onTemplate(d.date)} />}
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
                <td key={d.date} className="border-t border-divider pt-2 align-top">
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
              {d.rest ? null : <TemplateButton day={d} onClick={() => onTemplate(d.date)} />}
              <RestToggle day={d} pending={restPending === d.date} onToggle={() => onToggleRest(d.date, !d.rest)} />
            </div>
            <TotalBadge day={d} limit={screenLimitMin} />
            {d.rest ? (
              <p className="m-0 flex items-center gap-1.5 text-small font-semibold text-fg-muted">
                <ConsoleIcon name="moon" size={16} />
                Hari istirahat, tidak ada sesi.
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
