import Link from 'next/link'
import type { ReactNode } from 'react'
import { cx } from '@/components/ui/cx'
import { SiteFooter } from '@/components/ui/SiteFooter'

export type GuideTab = 'ortu' | 'anak' | 'aplikasi'

const TABS: { key: GuideTab; href: string; label: string }[] = [
  { key: 'ortu', href: '/panduan', label: 'Orang tua' },
  { key: 'anak', href: '/panduan/anak', label: 'Anak' },
  { key: 'aplikasi', href: '/panduan/aplikasi', label: 'Aplikasi' },
]

/** Kerangka tiga halaman panduan: merek, tab antarpanduan, isi, dan footer situs. */
export function GuideFrame({ tab, children }: { tab: GuideTab; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="mx-auto flex w-full max-w-[1120px] items-center gap-2 px-4 pt-4 pb-2">
        <Link href="/" prefetch={false} className="font-display text-h1 leading-9 font-bold text-fg no-underline hover:text-fg">
          Kira
        </Link>
        <nav aria-label="Panduan" className="ml-auto flex items-center gap-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              prefetch={false}
              aria-current={t.key === tab ? 'page' : undefined}
              className={cx('inline-flex min-h-11 items-center rounded-pill px-3 font-bold no-underline max-sm:px-2.5 max-sm:text-small', t.key === tab ? 'bg-lavender' : 'hover:bg-lavender')}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="isi" className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 pt-2 pb-12">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
