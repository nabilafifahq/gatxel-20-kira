'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useId, useState, type ReactNode } from 'react'
import type { ConsoleShell as ConsoleShellDTO } from '@/lib/dto'
import { cx } from './cx'
import { Dialog } from './Dialog'
import { ConsoleIcon, type ConsoleIconName } from './icons'
import { CONSOLE_ROUTES } from './routes'
import { ToastProvider } from './Toast'

/**
 * Kerangka konsol tutor (papan TutorHariIni dan TutorHariIniHP).
 * Layar lebar: sidebar 232px dengan dua kelompok tautan dan pemilih learner.
 * HP dan tablet portrait: header 60px, navigasi bawah 72px (Hari ini, Rencana,
 * Input LJK, Lainnya). Lainnya membuka daftar semua halaman.
 * Pemilih learner mengganti `?learner=<id>` di alamat halaman yang sama.
 */

export type ConsoleNavKey =
  | 'today'
  | 'plan'
  | 'inbox'
  | 'ljk'
  | 'bank'
  | 'paper'
  | 'competitions'
  | 'reports'
  | 'settings'
  | 'studio'
  | 'import'
  | 'learners'
  | 'claude'

type NavItem = { key: ConsoleNavKey; label: string; icon: ConsoleIconName; href: string; match: ConsoleNavKey[] }

const MAIN: NavItem[] = [
  { key: 'today', label: 'Hari ini', icon: 'today', href: CONSOLE_ROUTES.today, match: ['today'] },
  { key: 'plan', label: 'Rencana', icon: 'plan', href: CONSOLE_ROUTES.plan, match: ['plan'] },
  { key: 'inbox', label: 'Hasil', icon: 'inbox', href: CONSOLE_ROUTES.inbox, match: ['inbox', 'ljk'] },
  { key: 'bank', label: 'Bank soal', icon: 'bank', href: CONSOLE_ROUTES.bank, match: ['bank', 'paper'] },
  { key: 'competitions', label: 'Lomba', icon: 'trophy', href: CONSOLE_ROUTES.competitions, match: ['competitions'] },
  { key: 'reports', label: 'Laporan', icon: 'report', href: CONSOLE_ROUTES.reports, match: ['reports'] },
  { key: 'settings', label: 'Pengaturan', icon: 'settings', href: CONSOLE_ROUTES.settings, match: ['settings'] },
]

function toolItems(aiEnabled: boolean): NavItem[] {
  return [
    ...(aiEnabled ? [{ key: 'studio' as const, label: 'Studio AI', icon: 'sparkle' as const, href: CONSOLE_ROUTES.studio, match: ['studio' as const] }] : []),
    { key: 'import', label: 'Impor', icon: 'import', href: CONSOLE_ROUTES.import, match: ['import'] },
    { key: 'learners', label: 'Learner', icon: 'learners', href: CONSOLE_ROUTES.learners, match: ['learners'] },
    { key: 'claude', label: 'Koneksi Claude', icon: 'plug', href: CONSOLE_ROUTES.claude, match: ['claude'] },
  ]
}

/** Tautan tambahan yang hanya muncul di daftar Lainnya (HP). */
const EXTRA_MOBILE: NavItem[] = [
  { key: 'paper', label: 'Penyusun paper', icon: 'paper', href: CONSOLE_ROUTES.paper, match: ['paper'] },
  { key: 'inbox', label: 'Hasil', icon: 'inbox', href: CONSOLE_ROUTES.inbox, match: ['inbox'] },
]

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-11 items-center gap-3 rounded-control border-2 px-3 text-body no-underline',
        active ? 'border-fg bg-bg font-bold text-fg' : 'border-transparent font-semibold text-fg-muted hover:bg-bg hover:text-fg',
      )}
    >
      <ConsoleIcon name={item.icon} size={20} />
      {item.label}
    </Link>
  )
}

function LearnerSwitcher({ shell, compact }: { shell: ConsoleShellDTO; compact?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const id = useId()
  if (shell.learners.length === 0) return null
  const current = shell.currentLearnerId ?? shell.learners[0]?.id ?? ''
  if (shell.learners.length === 1) {
    const l = shell.learners[0]!
    return (
      <span className={cx('inline-flex min-w-0 items-center gap-2 font-bold', compact ? 'text-small' : 'text-body')}>
        <ConsoleIcon name="learners" size={18} />
        <span className="truncate">
          {l.name}
          {compact ? '' : `, Grade ${l.grade}`}
        </span>
      </span>
    )
  }
  return (
    <div className={cx('flex min-w-0 flex-col gap-1', compact && 'max-w-[170px]')}>
      <label htmlFor={`learner-${id}`} className={compact ? 'visually-hidden' : 'text-small font-bold text-fg-muted'}>
        Learner aktif
      </label>
      <div className="relative">
        <select
          id={`learner-${id}`}
          value={current}
          onChange={(e) => router.push(`${pathname}?learner=${encodeURIComponent(e.target.value)}`)}
          className={cx(
            'w-full min-w-0 cursor-pointer appearance-none rounded-control border-2 border-border bg-surface pr-9 pl-3 font-bold text-fg hover:border-fg',
            compact ? 'h-11 text-body' : 'h-11 text-body',
          )}
        >
          {shell.learners.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}, Grade {l.grade}
            </option>
          ))}
        </select>
        <ConsoleIcon name="chevronDown" size={16} strokeWidth={2.5} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2" />
      </div>
    </div>
  )
}

export function ConsoleShell({
  shell,
  active,
  children,
}: {
  shell: ConsoleShellDTO
  active: ConsoleNavKey
  children: ReactNode
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const tools = toolItems(shell.aiEnabled)
  const bottom: { key: string; label: string; icon: ConsoleIconName; href?: string; on: boolean }[] = [
    { key: 'today', label: 'Hari ini', icon: 'today', href: CONSOLE_ROUTES.today, on: active === 'today' },
    { key: 'plan', label: 'Rencana', icon: 'plan', href: CONSOLE_ROUTES.plan, on: active === 'plan' },
    { key: 'ljk', label: 'Input LJK', icon: 'ljk', href: CONSOLE_ROUTES.ljk, on: active === 'ljk' },
    { key: 'more', label: 'Lainnya', icon: 'more', on: !['today', 'plan', 'ljk'].includes(active) },
  ]
  const moreItems = [...MAIN.filter((i) => !['today', 'plan'].includes(i.key)), EXTRA_MOBILE[0]!, ...tools]

  return (
    <ToastProvider>
      <div className="flex min-h-svh flex-col bg-bg text-fg lg:flex-row">
        <a
          href="#isi"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:h-auto focus:w-auto focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:font-bold"
        >
          Langsung ke isi
        </a>

        {/* Sidebar layar lebar */}
        <nav
          aria-label="Konsol tutor"
          className="hidden flex-none flex-col gap-1.5 border-r border-divider bg-surface px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-svh lg:w-[232px] lg:overflow-y-auto"
        >
          <div className="flex items-baseline gap-2.5 px-3 pb-4">
            <span className="font-display text-h1 leading-8 font-bold">Kira</span>
            <span className="text-small text-fg-muted">Konsol tutor</span>
          </div>
          <div className="px-1 pb-4">
            <LearnerSwitcher shell={shell} />
          </div>
          {MAIN.map((item) => (
            <SideLink key={item.key} item={item} active={item.match.includes(active)} />
          ))}
          <div className="mx-3 my-3 h-px bg-divider" role="presentation" />
          <span className="px-3 pb-1 text-small font-bold text-fg-muted">Alat</span>
          {tools.map((item) => (
            <SideLink key={item.key} item={item} active={item.match.includes(active)} />
          ))}
          <div className="mt-auto flex flex-col gap-2 border-t border-divider px-3 pt-4">
            <span className="flex flex-col">
              <span className="text-body font-bold">{shell.userName}</span>
              <span className="text-small text-fg-muted">{shell.orgName}</span>
            </span>
            <form method="post" action={CONSOLE_ROUTES.signOut}>
              <button
                type="submit"
                className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-0 text-body font-semibold text-fg underline-offset-3 hover:underline"
              >
                <ConsoleIcon name="logout" size={18} />
                Keluar
              </button>
            </form>
          </div>
        </nav>

        {/* Header HP dan tablet portrait */}
        <header className="sticky top-0 z-30 flex h-[60px] flex-none items-center gap-2.5 border-b border-divider bg-surface px-4 lg:hidden">
          <span className="font-display text-h1 leading-8 font-bold">Kira</span>
          <span className="text-small text-fg-muted max-[360px]:hidden">Konsol tutor</span>
          <div className="ml-auto min-w-0">
            <LearnerSwitcher shell={shell} compact />
          </div>
        </header>

        <main id="isi" className="flex min-w-0 flex-1 flex-col pb-[96px] lg:pb-0">
          <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 px-4 pt-5 pb-8 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">{children}</div>
        </main>

        {/* Navigasi bawah HP */}
        <nav aria-label="Konsol tutor" className="fixed inset-x-0 bottom-0 z-30 flex h-[72px] gap-1.5 border-t border-divider bg-surface px-3 py-1.5 lg:hidden">
          {bottom.map((b) =>
            b.href ? (
              <Link
                key={b.key}
                href={b.href}
                aria-current={b.on ? 'page' : undefined}
                className={cx(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-control border-2 text-small leading-5 no-underline',
                  b.on ? 'border-fg bg-bg font-bold text-fg' : 'border-transparent font-semibold text-fg-muted',
                )}
              >
                <ConsoleIcon name={b.icon} size={22} />
                {b.label}
              </Link>
            ) : (
              <button
                key={b.key}
                type="button"
                aria-haspopup="dialog"
                onClick={() => setMoreOpen(true)}
                className={cx(
                  'flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-control border-2 bg-transparent text-small leading-5',
                  b.on ? 'border-fg bg-bg font-bold text-fg' : 'border-transparent font-semibold text-fg-muted',
                )}
              >
                <ConsoleIcon name={b.icon} size={22} />
                {b.label}
              </button>
            ),
          )}
        </nav>

        <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Semua halaman" size="sm">
          <nav aria-label="Semua halaman konsol">
            <ul className="m-0 grid list-none grid-cols-1 gap-1.5 p-0 min-[400px]:grid-cols-2">
              {moreItems.map((item) => (
                <li key={`${item.key}-${item.label}`}>
                  <Link
                    href={item.href}
                    aria-current={item.match.includes(active) && item.key === active ? 'page' : undefined}
                    onClick={() => setMoreOpen(false)}
                    className={cx(
                      'flex h-12 items-center gap-3 rounded-control border-2 px-3 text-body no-underline',
                      item.key === active ? 'border-fg bg-bg font-bold text-fg' : 'border-divider font-semibold text-fg hover:border-fg',
                    )}
                  >
                    <ConsoleIcon name={item.icon} size={20} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-divider pt-4">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body font-bold">{shell.userName}</span>
                <span className="truncate text-small text-fg-muted">{shell.orgName}</span>
              </span>
              <form method="post" action={CONSOLE_ROUTES.signOut}>
                <button
                  type="submit"
                  className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-control border-2 border-border bg-surface px-4 font-bold text-fg"
                >
                  <ConsoleIcon name="logout" size={18} />
                  Keluar
                </button>
              </form>
            </div>
          </nav>
        </Dialog>
      </div>
    </ToastProvider>
  )
}
