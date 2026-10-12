import Link from 'next/link'
import type { ReactNode } from 'react'
import { cx } from '@/components/console/cx'
import { PUBLIC_ROUTES } from '@/components/console/routes'

/**
 * Kerangka halaman publik (papan MasukDewasa, HalamanError, Privasi, Ketentuan):
 * merek Kira di kiri atas, isi di tengah, tautan dokumen hukum di bawah.
 * Tanpa hook, jadi bisa dipakai komponen server maupun client.
 */
export function PublicFrame({
  children,
  headerAction,
  footerNote,
  current,
  center = true,
  brandHref = PUBLIC_ROUTES.login,
  showLegal = true,
}: {
  children: ReactNode
  headerAction?: ReactNode
  footerNote?: ReactNode
  current?: 'privacy' | 'terms'
  center?: boolean
  brandHref?: string | null
  /** false untuk halaman berbahasa en-GB (layar learner): tanpa tautan dokumen berbahasa Indonesia. */
  showLegal?: boolean
}) {
  return (
    <div className="flex min-h-svh flex-col items-center bg-bg px-4 pt-6 pb-8 text-fg">
      <header className="flex w-full max-w-[1120px] items-center gap-3">
        {brandHref ? (
          <Link href={brandHref} className="font-display text-h1 leading-9 font-bold text-fg no-underline hover:text-fg">
            Kira
          </Link>
        ) : (
          <span className="font-display text-h1 leading-9 font-bold">Kira</span>
        )}
        {headerAction ? <div className="ml-auto">{headerAction}</div> : null}
      </header>
      <main
        id="isi"
        className={cx('flex w-full max-w-[1120px] flex-1 flex-col', center ? 'items-center justify-center py-8' : 'pt-8')}
      >
        {children}
      </main>
      {showLegal ? (
      <footer className="mt-6 flex w-full max-w-[1120px] flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-divider pt-5 text-body">
        <Link href={PUBLIC_ROUTES.privacyNotice} aria-current={current === 'privacy' ? 'page' : undefined} className="inline-flex min-h-11 items-center font-bold">
          Kebijakan Privasi
        </Link>
        <Link href={PUBLIC_ROUTES.terms} aria-current={current === 'terms' ? 'page' : undefined} className="inline-flex min-h-11 items-center font-bold">
          Syarat dan Ketentuan
        </Link>
        {footerNote ? <span className="text-fg-muted sm:ml-auto">{footerNote}</span> : null}
      </footer>
      ) : null}
    </div>
  )
}

/** Kartu tengah 440px untuk formulir masuk dan sejenisnya. */
export function AuthCard({ children, labelledBy }: { children: ReactNode; labelledBy: string }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="flex w-full max-w-[440px] flex-col gap-5 rounded-card border border-divider bg-surface p-8 max-sm:p-5"
    >
      {children}
    </section>
  )
}
