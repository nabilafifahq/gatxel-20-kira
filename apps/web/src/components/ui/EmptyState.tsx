import type { ReactElement, ReactNode } from 'react'
import { cx } from './cx'

/**
 * Keadaan kosong (papan EmptyState). Judul menyebut apa yang kosong, isi menyebut
 * sebab dan langkah berikutnya, satu aksi utama dan paling banyak satu aksi kedua.
 * Learner: garis putus-putus dan tombol 56 px. Konsol: kartu biasa dan tombol 44 px.
 * Varian filter tanpa hasil selalu menyebut filter yang aktif lewat `filters`.
 */
export function EmptyState({
  title,
  body,
  art,
  actions,
  filters,
  tone = 'learner',
  className,
  headingLevel = 2,
}: {
  title: ReactNode
  body?: ReactNode
  /** Gambar garis sederhana, tanpa emoji. */
  art?: ReactNode
  /** Tombol (Button atau ButtonLink) sesuai ukuran area. */
  actions?: ReactNode
  /** Label filter aktif, misalnya "Mapel: Science". */
  filters?: string[]
  tone?: 'learner' | 'console'
  className?: string
  headingLevel?: 2 | 3
}): ReactElement {
  const learner = tone === 'learner'
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section
      role="status"
      className={cx(
        'flex flex-col items-center justify-center text-center',
        learner ? 'gap-3 rounded-card border-2 border-dashed border-border bg-surface p-8' : 'gap-2.5 rounded-card border border-divider bg-surface p-8',
        className,
      )}
    >
      {art ? <div aria-hidden="true" className="text-border">{art}</div> : null}
      {filters && filters.length > 0 ? (
        <ul aria-label={learner ? 'Filters' : 'Filter aktif'} className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0">
          {filters.map((f) => (
            <li key={f} className="inline-flex h-7.5 items-center rounded-pill border border-border bg-surface px-2.5 text-small font-semibold">
              {f}
            </li>
          ))}
        </ul>
      ) : null}
      <Heading className={cx('m-0 max-w-[460px] font-bold', learner ? 'text-h3' : 'text-body-lg')}>{title}</Heading>
      {body ? <p className={cx('m-0 max-w-[460px] text-fg-muted', learner ? 'text-body-lg' : 'text-body')}>{body}</p> : null}
      {actions ? <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">{actions}</div> : null}
    </section>
  )
}
