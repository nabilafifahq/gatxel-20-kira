'use client'

import { AccountMenu } from '@/components/ui/AccountMenu'
import { SiteFooter } from '@/components/ui/SiteFooter'
import { SiteHeader } from '@/components/ui/SiteHeader'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ConsoleShell } from '@/lib/dto'
import { cx } from '@/components/console/cx'
import { ConsoleIcon } from '@/components/console/icons'
import { CONSOLE_ROUTES, FAMILY_ROUTES, PUBLIC_ROUTES } from '@/components/console/routes'
import { ToastProvider } from '@/components/console/Toast'

/**
 * Kerangka halaman orang tua (papan RingkasanMinggu, PrivasiKeluarga): dirancang untuk HP,
 * header situs dengan menu akun, navigasi keluarga, isi selebar 640px di layar lebar, footer situs di bawah isi.
 */
export function FamilyShell({
  shell,
  active,
  learnerName,
  children,
}: {
  shell: ConsoleShell
  active: 'home' | 'week' | 'coach' | 'sheet' | 'report' | 'privacy'
  learnerName?: string
  children: ReactNode
}) {
  // Anak yang sedang dipilih ikut pindah antara Ringkasan dan Privasi.
  const q = shell.currentLearnerId ? `?learner=${encodeURIComponent(shell.currentLearnerId)}` : ''
  const nav = [
    { key: 'home', label: 'Anak saya', href: FAMILY_ROUTES.home, icon: 'learners' as const },
    { key: 'week', label: 'Minggu ini', href: `${FAMILY_ROUTES.week}${q}`, icon: 'report' as const },
    { key: 'coach', label: 'Pelatih', href: `${FAMILY_ROUTES.coach}${q}`, icon: 'sparkle' as const },
    { key: 'sheet', label: 'Lembar kerja', href: `${FAMILY_ROUTES.sheet}${q}`, icon: 'printer' as const },
    { key: 'report', label: 'Rapor', href: `${FAMILY_ROUTES.report}${q}`, icon: 'paper' as const },
    { key: 'privacy', label: 'Privasi', href: `${FAMILY_ROUTES.privacy}${q}`, icon: 'shield' as const },
    { key: 'help', label: 'Bantuan', href: `${PUBLIC_ROUTES.feedback}?dari=${FAMILY_ROUTES.home}`, icon: 'chat' as const },
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
        <SiteHeader
          brandHref={FAMILY_ROUTES.home}
          inner="max-w-[720px]"
          account={<AccountMenu name={shell.userName} detail={shell.orgName} links={[{ href: FAMILY_ROUTES.home, label: 'Anak saya' }, { href: FAMILY_ROUTES.privacy, label: 'Privasi keluarga' }]} signOutHref={CONSOLE_ROUTES.signOut} />}
        >
          {learnerName ? (
            <p className="mx-auto m-0 flex max-w-[720px] items-center gap-2 px-4 pb-1 text-small font-bold">
              <ConsoleIcon name="learners" size={18} />
              {learnerName}
            </p>
          ) : null}
          <nav aria-label="Halaman keluarga" className="mx-auto flex max-w-[720px] gap-1 overflow-x-auto px-2 lg:max-w-[880px] lg:justify-center">
            {nav.map((n) => {
              const on = n.key === active
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  aria-current={on ? 'page' : undefined}
                  className={cx(
                    '-mb-px inline-flex h-11 flex-none items-center gap-2 whitespace-nowrap border-0 border-b-3 px-3 text-body text-fg no-underline hover:text-fg',
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
        </SiteHeader>
        <main id="isi" className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-[22px] px-4 pt-5 pb-8">
          {children}
        </main>
        <SiteFooter />
      </div>
    </ToastProvider>
  )
}
