import Link from 'next/link'
import type { ReactElement, ReactNode } from 'react'
import { cx } from './cx'
import { KiraLogo } from './KiraStar'

const NAV_LINK = 'kira-press inline-flex min-h-11 items-center rounded-control px-2 font-bold text-fg no-underline hover:bg-lavender hover:text-fg sm:px-3'

export const SIGN_IN_CLASS =
  'kira-press ml-1 inline-flex min-h-11 cursor-pointer items-center rounded-control border-2 border-fg bg-fg px-4 text-body font-extrabold text-white no-underline hover:text-white max-sm:px-3 max-sm:text-small'

export function SignInLink(): ReactElement {
  return (
    <Link href="/masuk" className={SIGN_IN_CLASS}>
      Masuk
    </Link>
  )
}

/**
 * Header situs: logo ke beranda, Panduan, Bantuan, lalu Masuk atau menu akun (lewat `account`).
 * Tanpa hook, jadi bisa dipakai komponen server maupun client. `inner` membatasi lebar isi supaya sejajar dengan kerangka.
 */
export function SiteHeader({
  brandHref = '/',
  account,
  showNav = true,
  inner = 'max-w-[1120px]',
  children,
}: {
  brandHref?: string | null
  /** Tombol Masuk bawaan bila kosong. `null` menyembunyikannya. */
  account?: ReactNode
  showNav?: boolean
  inner?: string
  /** Baris kedua di bawah header, misalnya navigasi keluarga. */
  children?: ReactNode
}): ReactElement {
  return (
    <header lang="id" data-testid="site-header" className="pt-safe sticky top-0 z-30 border-b border-divider bg-surface print:hidden">
      <div className={cx('mx-auto flex h-14 w-full items-center gap-1 px-4', inner)}>
        {brandHref ? (
          <Link href={brandHref} aria-label="Kira, halaman utama" className="kira-press mr-auto inline-flex min-h-11 items-center text-fg no-underline hover:text-fg">
            <KiraLogo size={40} />
          </Link>
        ) : (
          <span className="mr-auto inline-flex">
            <KiraLogo size={40} />
          </span>
        )}
        {showNav ? (
          <nav aria-label="Menu utama" className="flex items-center gap-0.5 text-body max-sm:text-small">
            <Link href="/panduan" prefetch={false} className={cx(NAV_LINK, 'max-[359px]:hidden')}>
              Panduan
            </Link>
            <Link href="/feedback" prefetch={false} className={NAV_LINK}>
              Bantuan
            </Link>
          </nav>
        ) : null}
        {account === undefined ? <SignInLink /> : account}
      </div>
      {children}
    </header>
  )
}
