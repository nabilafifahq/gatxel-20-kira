import type { ReactNode } from 'react'
import { cx } from '@/components/console/cx'
import { SiteFooter } from '@/components/ui/SiteFooter'
import { SiteHeader } from '@/components/ui/SiteHeader'

/**
 * Kerangka halaman publik (papan MasukDewasa, HalamanError, Privasi, Ketentuan): header situs, isi di tengah,
 * footer situs di bawah isi. Tanpa hook, jadi bisa dipakai komponen server maupun client.
 */
export function PublicFrame({
  children,
  headerAction,
  footerNote,
  current,
  center = true,
  brandHref = '/',
  showLegal = true,
}: {
  children: ReactNode
  /** Mengganti tombol Masuk di header, misalnya menu akun. */
  headerAction?: ReactNode
  footerNote?: ReactNode
  current?: 'privacy' | 'terms'
  center?: boolean
  brandHref?: string | null
  /** false untuk halaman berbahasa en-GB (layar learner): header tanpa menu, footer tanpa tautan keluar. */
  showLegal?: boolean
}) {
  return (
    <div className="flex min-h-svh flex-col bg-bg text-fg">
      <SiteHeader brandHref={brandHref} showNav={showLegal} account={headerAction ?? (showLegal ? undefined : null)} />
      <main id="isi" className={cx('mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4', center ? 'items-center justify-center py-8' : 'pt-8 pb-10')}>
        {children}
      </main>
      <SiteFooter area={showLegal ? 'public' : 'learner'} note={footerNote} current={current} />
    </div>
  )
}

/** Kartu tengah 440px untuk formulir masuk dan sejenisnya. */
export function AuthCard({ children, labelledBy, bare = false }: { children: ReactNode; labelledBy: string; /** Tanpa kartu, untuk panel kanan layar masuk. */ bare?: boolean }) {
  if (bare) {
    return (
      <section aria-labelledby={labelledBy} className="flex w-full flex-col gap-5">
        {children}
      </section>
    )
  }
  return (
    <section
      aria-labelledby={labelledBy}
      className="flex w-full max-w-[440px] flex-col gap-5 rounded-card bg-surface shadow-soft p-8 max-sm:p-5"
    >
      {children}
    </section>
  )
}
