'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ConsoleShell } from '@/lib/dto'
import { cx } from '@/components/console/cx'
import { ConsoleIcon } from '@/components/console/icons'
import { CONSOLE_ROUTES, FAMILY_ROUTES, PUBLIC_ROUTES } from '@/components/console/routes'
import { ToastProvider } from '@/components/console/Toast'

/**
 * Kerangka halaman orang tua (papan RingkasanMinggu, PrivasiKeluarga): dirancang untuk HP,
 * header 60px, isi selebar 640px di layar lebar, dua tujuan utama (Ringkasan, Privasi).
 */
export function FamilyShell({
  shell,
  active,
  learnerName,
  children,
}: {
  shell: ConsoleShell
  active: 'home' | 'privacy'
  learnerName?: string
  children: ReactNode
}) {
  // Anak yang sedang dipilih ikut pindah antara Ringkasan dan Privasi.
  const q = shell.currentLearnerId ? `?learner=${encodeURIComponent(shell.currentLearnerId)}` : ''
  const nav = [
    { key: 'home', label: 'Ringkasan', href: `${FAMILY_ROUTES.home}${q}`, icon: 'report' as const },
    { key: 'privacy', label: 'Privasi', href: `${FAMILY_ROUTES.privacy}${q}`, icon: 'shield' as const },
  ]
  return (
    <ToastProvider>
      <div className="flex min-h-svh flex-col bg-bg text-fg">
        <a
          href="#isi"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:font-bold"
        >
          Langsung ke isi
        </a>
        <header className="sticky top-0 z-30 border-b border-divider bg-surface">
          <div className="mx-auto flex h-[60px] max-w-[720px] items-center gap-2.5 px-4">
            <span className="font-display text-h1 leading-8 font-bold">Kira</span>
            <span className="text-small text-fg-muted">Laporan keluarga</span>
            {learnerName ? (
              <span className="ml-auto inline-flex items-center gap-2 text-small font-bold">
                <ConsoleIcon name="learners" size={18} />
                {learnerName}
              </span>
            ) : null}
          </div>
          <nav aria-label="Halaman keluarga" className="mx-auto flex max-w-[720px] gap-1 px-2">
            {nav.map((n) => {
              const on = n.key === active
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  aria-current={on ? 'page' : undefined}
                  className={cx(
                    '-mb-px inline-flex h-11 items-center gap-2 border-0 border-b-3 px-3 text-body text-fg no-underline hover:text-fg',
                    on ? 'border-fg font-extrabold' : 'border-transparent font-semibold text-fg-muted',
                  )}
                >
                  <ConsoleIcon name={n.icon} size={18} />
                  {n.label}
                </Link>
              )
            })}
            {shell.role === 'tutor' ? (
              <Link href={CONSOLE_ROUTES.today} className="ml-auto inline-flex h-11 items-center px-3 text-small font-bold">
                Konsol tutor
              </Link>
            ) : null}
          </nav>
        </header>
        <main id="isi" className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-[22px] px-4 pt-5 pb-8">
          {children}
        </main>
        <footer className="mx-auto flex w-full max-w-[720px] flex-wrap items-center gap-x-5 gap-y-2 border-t border-divider px-4 py-5 text-small">
          <span className="text-fg-muted">
            {shell.userName}, {shell.orgName}
          </span>
          <Link href={PUBLIC_ROUTES.privacyNotice}>Kebijakan Privasi</Link>
          <Link href={PUBLIC_ROUTES.terms}>Syarat dan Ketentuan</Link>
          <form method="post" action={CONSOLE_ROUTES.signOut} className="ml-auto">
            <button type="submit" className="inline-flex h-11 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-small font-bold text-fg underline underline-offset-3">
              <ConsoleIcon name="logout" size={16} />
              Keluar
            </button>
          </form>
        </footer>
      </div>
    </ToastProvider>
  )
}
