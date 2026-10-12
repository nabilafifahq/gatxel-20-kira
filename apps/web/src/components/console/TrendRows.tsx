import type { Subject, TrendPoint } from '@/lib/dto'
import { cx } from './cx'
import { SUBJECT_FILL, SUBJECT_LABEL, SUBJECT_STROKE } from './format'
import { ConsoleIcon } from './icons'

/**
 * Tren akurasi per mapel sebagai garis SVG kecil (satu baris per mapel), dengan
 * label nilai di setiap titik, perubahan dalam teks dan ikon, dan tabel alternatif
 * yang bisa dibuka semua orang. Titik tanpa data digambar putus-putus dengan tanda "?".
 */

const W = 232
const H = 64
const PAD_X = 16
const TOP = 20
const BOTTOM = 8

function delta(points: TrendPoint[]): { diff: number; lastKnownIndex: number } | null {
  const known = points.map((p, i) => ({ v: p.accuracy, i })).filter((x): x is { v: number; i: number } => x.v != null)
  if (known.length < 2) return null
  return { diff: Math.round(known[known.length - 1]!.v - known[0]!.v), lastKnownIndex: known[known.length - 1]!.i }
}

export function trendSentence(points: TrendPoint[]): { text: string; dir: 'up' | 'down' | 'flat' | 'none' } {
  const d = delta(points)
  if (!d) return { text: 'Belum cukup data untuk melihat tren', dir: 'none' }
  const word = d.diff < 0 ? `turun ${-d.diff} poin` : d.diff > 0 ? `naik ${d.diff} poin` : 'tetap'
  const lastMissing = points[points.length - 1]?.accuracy == null
  const lastLabel = points[d.lastKnownIndex]?.label ?? ''
  return {
    text: lastMissing ? `${word} sampai ${lastLabel}, minggu ini belum ada data` : `${word} dalam ${points.length} minggu`,
    dir: d.diff < 0 ? 'down' : d.diff > 0 ? 'up' : 'flat',
  }
}

function Sparkline({ subject, points }: { subject: Subject; points: TrendPoint[] }) {
  const n = points.length
  const xs = points.map((_, i) => (n <= 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (n - 1)))
  const known = points.map((p) => p.accuracy).filter((v): v is number => v != null)
  const lo = Math.max(0, Math.min(40, Math.floor(((known.length ? Math.min(...known) : 40) - 10) / 10) * 10))
  const y = (v: number) => TOP + (1 - (Math.max(lo, v) - lo) / (100 - lo)) * (H - TOP - BOTTOM)
  const segs: string[] = []
  let cur: string[] = []
  points.forEach((p, i) => {
    if (p.accuracy == null) {
      if (cur.length > 1) segs.push(cur.join(' '))
      cur = []
    } else cur.push(`${xs[i]!.toFixed(1)},${y(p.accuracy).toFixed(1)}`)
  })
  if (cur.length > 1) segs.push(cur.join(' '))
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false" className="max-w-full flex-none">
      <line x1={PAD_X} x2={W - PAD_X} y1={y(70)} y2={y(70)} className="stroke-divider" strokeWidth="1" strokeDasharray="3 4" />
      {segs.map((s, i) => (
        <polyline key={i} points={s} fill="none" className={SUBJECT_STROKE[subject]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {points.map((p, i) => {
        const x = xs[i]!
        if (p.accuracy == null) {
          const cy = y((lo + 100) / 2)
          return (
            <g key={p.weekStart}>
              <circle cx={x} cy={cy} r="5" className="fill-surface stroke-border" strokeWidth="2" strokeDasharray="2 2" />
              <text x={x} y={cy - 10} textAnchor="middle" className="fill-fg-muted font-body" fontSize="13" fontWeight="700">
                ?
              </text>
            </g>
          )
        }
        const cy = y(p.accuracy)
        return (
          <g key={p.weekStart}>
            <circle cx={x} cy={cy} r="4.5" className={cx(SUBJECT_FILL[subject], 'stroke-surface')} strokeWidth="1.5" />
            <text x={x} y={Math.max(12, cy - 9)} textAnchor="middle" className="fill-fg font-body tabular" fontSize="13" fontWeight="700">
              {Math.round(p.accuracy)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function TrendRows({ trend, caption }: { trend: { subject: Subject; points: TrendPoint[] }[]; caption: string }) {
  const labels = trend[0]?.points.map((p) => p.label) ?? []
  return (
    <div className="flex flex-col">
      <ul className="m-0 list-none p-0">
        {trend.map((t) => {
          const s = trendSentence(t.points)
          const aria = `${SUBJECT_LABEL[t.subject]}, akurasi ${t.points
            .map((p) => `${p.label} ${p.accuracy == null ? 'belum ada' : `${Math.round(p.accuracy)}%`}`)
            .join(', ')}. ${s.text}.`
          return (
            <li key={t.subject} aria-label={aria} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-divider py-3.5">
              <span className="w-24 flex-none text-body font-bold">{SUBJECT_LABEL[t.subject]}</span>
              <Sparkline subject={t.subject} points={t.points} />
              <span
                className={cx(
                  'inline-flex min-w-0 flex-[1_1_200px] items-center gap-2 text-body font-semibold',
                  s.dir === 'down' ? 'text-warn' : s.dir === 'up' ? 'text-success' : 'text-fg-muted',
                )}
              >
                {s.dir === 'down' ? <ConsoleIcon name="trendDown" size={20} strokeWidth={2.5} /> : null}
                {s.dir === 'up' ? <ConsoleIcon name="trendUp" size={20} strokeWidth={2.5} /> : null}
                {s.text}
              </span>
            </li>
          )
        })}
      </ul>
      <details className="group border-b border-divider py-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-body font-bold text-fg [&::-webkit-details-marker]:hidden">
          <ConsoleIcon name="chevronDown" size={18} strokeWidth={2.5} className="transition-transform duration-150 ease-kira group-open:rotate-180" />
          Tampilkan sebagai tabel
        </summary>
        <div role="region" aria-label={caption} tabIndex={0} className="relative mt-2 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-body">
            <caption className="visually-hidden">{caption}</caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-divider px-3 py-2 text-left text-small font-semibold text-fg-muted">
                  Mapel
                </th>
                {labels.map((l) => (
                  <th key={l} scope="col" className="border-b border-divider px-3 py-2 text-right text-small font-semibold text-fg-muted">
                    {l}
                  </th>
                ))}
                <th scope="col" className="border-b border-divider px-3 py-2 text-right text-small font-semibold text-fg-muted">
                  Jawaban minggu ini
                </th>
              </tr>
            </thead>
            <tbody>
              {trend.map((t) => (
                <tr key={t.subject} className="border-b border-divider last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-left font-bold">
                    {SUBJECT_LABEL[t.subject]}
                  </th>
                  {t.points.map((p) => (
                    <td key={p.weekStart} className="px-3 py-2 text-right tabular">
                      {p.accuracy == null ? 'belum ada' : `${Math.round(p.accuracy)}%`}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular">{t.points[t.points.length - 1]?.answers ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
