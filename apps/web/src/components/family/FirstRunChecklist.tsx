import Link from 'next/link'
import type { ReactElement } from 'react'
import { UiIcon } from '@/components/ui/icons'
import { cx } from '@/components/ui/cx'
import { FAMILY_ROUTES } from '@/components/console/routes'
import type { ChecklistItem, ChecklistKey } from '@/server/dal/onboarding'

const COPY: Record<ChecklistKey, { label: string; hint: string; href: string }> = {
  child: { label: 'Tambah anak', hint: 'Nama, kelas, dan PIN gambar.', href: '/mulai?langkah=1' },
  path: { label: 'Pilih jalur', hint: 'Pakai rekomendasi sekali ketuk, atau atur sendiri.', href: '/mulai?langkah=2' },
  session: { label: 'Anak menyelesaikan sesi pertama', hint: 'Lihat cara anak masuk di tablet atau HP.', href: '/mulai?langkah=3' },
  report: { label: 'Lihat laporan pertama', hint: 'Ringkasan minggu ini ada di Minggu ini.', href: FAMILY_ROUTES.week },
}

/** Daftar langkah pertama di beranda keluarga. Hilang sendiri setelah semua selesai (server mengirim null). */
export function FirstRunChecklist({ items }: { items: ChecklistItem[] }): ReactElement {
  const done = items.filter((i) => i.done).length
  return (
    <section aria-labelledby="langkah-awal" data-testid="first-run-checklist" className="flex flex-col gap-3 rounded-card bg-lavender p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="langkah-awal" className="m-0 text-h3 font-bold">
          Langkah pertama
        </h2>
        <span className="flex-none font-numbers text-body font-bold tabular-nums">
          {done} dari {items.length}
        </span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((i) => {
          const c = COPY[i.key]
          const icon = i.done ? <UiIcon name="check-circle" size={24} className="text-success" /> : <span aria-hidden="true" className="inline-block size-6 rounded-pill border-2 border-fg" />
          return (
            <li key={i.key}>
              <Link
                href={c.href}
                className={cx('kira-press flex min-h-14 items-center gap-3 rounded-control bg-surface px-3 py-2 text-fg no-underline hover:text-fg')}
              >
                <span className="flex-none">{icon}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cx('text-body font-bold', i.done && 'line-through decoration-2')}>
                    {c.label}
                    <span className="visually-hidden">{i.done ? ', selesai' : ', belum'}</span>
                  </span>
                  {i.done ? null : <span className="text-small text-fg-muted">{c.hint}</span>}
                </span>
                <UiIcon name="chevron-right" size={20} className="flex-none" />
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
