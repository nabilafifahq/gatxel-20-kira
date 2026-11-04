import Link from 'next/link'
import type { ReactElement, ReactNode } from 'react'
import { cx } from './cx'

/** Teks kredit dari pemilik. Jangan diubah kata per kata. */
export const SITE_CREDIT = 'Build by Gatxel @ 2026 Made with Love by GATteam'
export const PARTNER_URL = 'https://wa.me/6287794551486?text=Halo%20Tim%20Gatxel%2C%20saya%20tertarik%20berdiskusi%20kemitraan%20bersama%20Kira'

/** Bantuan menuju /feedback (dibangun di pilot/dukungan). */
export const SITE_LINKS = [
  { href: '/panduan', label: 'Panduan' },
  { href: '/feedback', label: 'Bantuan' },
  { href: '/privasi', label: 'Privasi' },
  { href: '/ketentuan', label: 'Syarat' },
] as const

/**
 * Footer untuk semua kerangka. Mengikuti isi, tidak menempel di layar. `area="learner"` tanpa tautan keluar
 * (CLAUDE.md aturan 5, area anak tidak punya tautan keluar). Runner dan sesi berwaktu tidak memakai komponen ini.
 */
export function SiteFooter({ area = 'public', note, current, className }: { area?: 'public' | 'learner'; note?: ReactNode; current?: 'privacy' | 'terms'; className?: string }): ReactElement {
  return (
    <footer lang="id" data-testid="site-footer" className={cx('border-t border-divider bg-bg text-small text-fg', className)}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-1 px-4 py-4 pb-[max(16px,var(--safe-bottom))]">
        <nav aria-label="Tautan situs" className="flex flex-wrap items-center gap-x-5">
          {SITE_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              aria-current={(current === 'privacy' && l.href === '/privasi') || (current === 'terms' && l.href === '/ketentuan') ? 'page' : undefined}
              className="inline-flex min-h-11 items-center font-bold"
            >
              {l.label}
            </Link>
          ))}
          {area === 'public' ? (
            <a href={PARTNER_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-3 sm:ml-auto">
              Partner with Gatxel
            </a>
          ) : null}
        </nav>
        {note ? <p className="m-0">{note}</p> : null}
        <p className="m-0" data-testid="site-credit">
          {SITE_CREDIT}
        </p>
      </div>
    </footer>
  )
}
