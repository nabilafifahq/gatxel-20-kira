'use client'

import type { HeatCell, LearnerDetailDTO } from '@/lib/dto'
import { cx } from './cx'
import { dateId, shortDateId, SUBJECT_BG50, SUBJECT_BORDER, SUBJECT_LABEL } from './format'
import { addDays } from '@kira/core/time'

/**
 * Peta penguasaan skill kali minggu (papan MasteryHeatmap, DetailLearner).
 * Angka selalu tertulis di sel, jadi warna bukan satu-satunya penanda.
 * Setiap sel tombol dengan label lengkap; sel terpilih memakai cincin 3px.
 * Ringkasan teks per skill tersedia di bawah peta untuk semua orang.
 */

export type HeatLevel = 'mastered' | 'review' | 'reteach' | 'empty'

export function levelOf(cell: HeatCell): HeatLevel {
  if (cell.accuracy == null || cell.answers === 0) return 'empty'
  if (cell.gate === 'mastered') return 'mastered'
  if (cell.gate === 'review') return 'review'
  if (cell.gate === 'reteach') return 'reteach'
  // gate 'new' dengan jawaban: tentukan dari akurasi
  return cell.accuracy >= 85 ? 'mastered' : cell.accuracy >= 70 ? 'review' : 'reteach'
}

export const LEVEL_WORD: Record<HeatLevel, string> = {
  mastered: 'dikuasai',
  review: 'review',
  reteach: 'ajar ulang',
  empty: 'belum ada soal',
}

const LEVEL_CLASS: Record<HeatLevel, string> = {
  mastered: 'border-2 border-fg bg-fg text-white',
  review: 'border-2 border-review bg-review text-fg',
  reteach: 'border-2 border-warn bg-surface text-warn',
  empty: 'border-2 border-dashed border-border bg-bg text-fg-muted',
}

/** "12 sampai 18 Oktober" atau "28 September sampai 4 Oktober". */
export function weekRange(weekStart: string): string {
  const end = addDays(weekStart, 6)
  const a = dateId(weekStart).split(' ')
  const b = dateId(end).split(' ')
  if (a[1] === b[1]) return `${a[0]} sampai ${b[0]} ${b[1]}`
  return `${a[0]} ${a[1]} sampai ${b[0]} ${b[1]}`
}

export function cellKey(skillId: string, week: number): string {
  return `${skillId}::${week}`
}

export function MasteryHeatmap({
  weeks,
  groups,
  selected,
  onSelect,
  learnerName,
}: {
  weeks: LearnerDetailDTO['weeks']
  groups: LearnerDetailDTO['heatmap']
  selected: string | null
  onSelect: (key: string) => void
  learnerName: string
}) {
  const cols = weeks.length
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div role="region" aria-labelledby="peta-cap" tabIndex={0} className="relative overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-1.5 text-body">
          <caption id="peta-cap" className="visually-hidden">
            Penguasaan skill {learnerName} per minggu, akurasi 10 soal terakhir
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-[220px] border-b border-divider pb-1.5 text-left align-bottom text-small font-semibold text-fg-muted">
                Skill
              </th>
              {weeks.map((w) => (
                <th key={w.weekStart} scope="col" className="border-b border-divider pb-1.5 text-center align-bottom text-small font-normal text-fg-muted">
                  <span className="block font-bold text-fg">{w.label}</span>
                  <span className="block">{shortDateId(w.weekStart)}</span>
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.subject}>
              <tr>
                <th scope="colgroup" colSpan={cols + 1} className="pt-3 text-left">
                  <span
                    className={cx(
                      'inline-flex h-7 items-center rounded-pill border px-2.5 text-small font-bold',
                      SUBJECT_BG50[g.subject],
                      SUBJECT_BORDER[g.subject],
                    )}
                  >
                    {SUBJECT_LABEL[g.subject]}
                  </span>
                </th>
              </tr>
              {g.skills.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className="pr-2 text-left text-body leading-[22px] font-semibold">
                    {s.title}
                  </th>
                  {s.cells.map((c, w) => {
                    const lv = levelOf(c)
                    const key = cellKey(s.id, w)
                    const on = selected === key
                    const wk = weeks[w]
                    const aria = `${s.title}, minggu ${wk ? dateId(wk.weekStart).replace(/ \d{4}$/, '') : w + 1}, ${
                      lv === 'empty' ? 'belum ada soal' : `${Math.round(c.accuracy ?? 0)}%, ${LEVEL_WORD[lv]}`
                    }`
                    return (
                      <td key={w} className="p-0">
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={aria}
                          onClick={() => onSelect(key)}
                          className={cx(
                            'h-11 w-full min-w-16 cursor-pointer rounded-control text-body font-bold tabular outline-offset-2',
                            LEVEL_CLASS[lv],
                            on && 'outline-3 outline-accent',
                          )}
                        >
                          {lv === 'empty' ? 'belum' : `${Math.round(c.accuracy ?? 0)}%`}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <ul aria-label="Arti warna" className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 border-t border-divider p-0 pt-2.5 text-small text-fg-muted">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-[22px] rounded-sm bg-fg" />
          Dikuasai, 85% ke atas
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-[22px] rounded-sm bg-review" />
          Review, 70 sampai 84%
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-[22px] rounded-sm border-2 border-warn bg-surface" />
          Ajar ulang, di bawah 70%
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-4 w-[22px] rounded-sm border-2 border-dashed border-border bg-bg" />
          Belum ada soal
        </li>
      </ul>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-body font-bold [&::-webkit-details-marker]:hidden">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className="transition-transform duration-150 ease-kira group-open:rotate-180">
            <path d="M6 9l6 6 6-6" />
          </svg>
          Ringkasan teks
        </summary>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 pt-1 text-body">
          {groups.flatMap((g) =>
            g.skills.map((s) => {
              const last = [...s.cells].reverse().find((c) => levelOf(c) !== 'empty')
              const lastIdx = last ? s.cells.lastIndexOf(last) : -1
              const prev = lastIdx > 0 ? [...s.cells.slice(0, lastIdx)].reverse().find((c) => levelOf(c) !== 'empty') : undefined
              const diff = last?.accuracy != null && prev?.accuracy != null ? Math.round(last.accuracy - prev.accuracy) : null
              return (
                <li key={`${g.subject}-${s.id}`}>
                  <span className="font-bold">
                    {SUBJECT_LABEL[g.subject]}, {s.title}:
                  </span>{' '}
                  {last
                    ? `${Math.round(last.accuracy ?? 0)}% di ${weeks[lastIdx]?.label ?? ''}, ${LEVEL_WORD[levelOf(last)]}${
                        diff == null ? '' : diff === 0 ? ', sama dengan minggu sebelumnya' : diff > 0 ? `, naik ${diff} poin` : `, turun ${-diff} poin`
                      }. ${s.stars} bintang.`
                    : 'belum ada soal dalam empat minggu ini.'}
                </li>
              )
            }),
          )}
        </ul>
      </details>
    </div>
  )
}
