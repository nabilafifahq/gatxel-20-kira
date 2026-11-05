'use client'

import Link from 'next/link'
import { SiteFooter } from '@/components/ui/SiteFooter'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Avatar, Icon } from '@kira/figures'
import type { PinActions, PinPicture, PinScreenDTO } from '@/lib/dto'
import { ButtonLink, IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { useTicker } from '@/components/learner/hooks'
import { avatarLabel } from '@/components/learner/LearnerHeader'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { Timer } from '@/components/learner/Timer'
import { useLang, useT } from '@/lib/i18n/client'
import { ActionError, SignInBar } from './common'

/**
 * L01 Masuk anak (papan MasukAnak, MasukAnakSalah, MasukAnakTerkunci). Empat gambar rahasia
 * berurutan dari grid 3 x 3 yang posisinya tetap. Setelah gambar keempat, PIN dikirim.
 *
 * Kontrak kegagalan submitPin yang dibaca layar ini: `fieldErrors.attemptsLeft` (angka sebagai
 * teks) untuk PIN salah, `fieldErrors.lockedUntil` (ISO) saat terkunci. Kegagalan tanpa
 * keduanya dianggap error biasa dan ditampilkan dengan pesan dan kode referensi.
 */

const LOCK_MINUTES = 15

type Phase =
  | { kind: 'enter' }
  | { kind: 'checking' }
  | { kind: 'wrong'; left: number | null }
  | { kind: 'error'; message: string; reference: string }
  | { kind: 'ok'; redirectTo: string }

export function PinScreen({
  data,
  actions,
  pickHref = LEARNER_ROUTES.pick,
  grownUpHref = LEARNER_ROUTES.grownUp,
}: {
  data: PinScreenDTO
  actions: PinActions
  pickHref?: string
  grownUpHref?: string
}): ReactElement {
  const t = useT()
  const lang = useLang()
  const router = useRouter()
  const [entered, setEntered] = useState<PinPicture[]>([])
  const [phase, setPhase] = useState<Phase>({ kind: 'enter' })
  const [lockedUntil, setLockedUntil] = useState<string | null>(() => data.lockedUntil)
  const now = useTicker(lockedUntil !== null)
  const remaining = lockedUntil ? Math.max(0, Math.ceil((Date.parse(lockedUntil) - now) / 1000)) : 0
  const locked = lockedUntil !== null && remaining > 0
  const busy = phase.kind === 'checking' || phase.kind === 'ok'
  const firstKey = useRef<HTMLButtonElement>(null)

  // Saat waktu tunggu habis, grid kembali dan fokus pindah ke gambar pertama.
  useEffect(() => {
    if (lockedUntil && remaining === 0 && Date.parse(lockedUntil) <= Date.now()) {
      setLockedUntil(null)
      setPhase({ kind: 'enter' })
      window.setTimeout(() => firstKey.current?.focus(), 0)
    }
  }, [lockedUntil, remaining])

  async function submit(pin: PinPicture[]) {
    setPhase({ kind: 'checking' })
    try {
      const res = await actions.submitPin(data.learnerId, pin)
      if (res.ok) {
        setPhase({ kind: 'ok', redirectTo: res.data.redirectTo })
        router.push(res.data.redirectTo)
        return
      }
      setEntered([])
      const fe = res.fieldErrors ?? {}
      const left = fe.attemptsLeft !== undefined && Number.isFinite(Number(fe.attemptsLeft)) ? Number(fe.attemptsLeft) : null
      if (fe.lockedUntil || left === 0) {
        setLockedUntil(fe.lockedUntil ?? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString())
        setPhase({ kind: 'enter' })
        return
      }
      if (left !== null || fe.pin !== undefined) {
        setPhase({ kind: 'wrong', left })
        return
      }
      setPhase({ kind: 'error', message: res.message, reference: res.reference })
    } catch {
      setEntered([])
      setPhase({ kind: 'error', message: t.shell.pin.noServer, reference: 'KRA-PIN-NET' })
    }
  }

  function pick(p: PinPicture) {
    if (busy || locked || entered.length >= 4) return
    const next = [...entered, p]
    setEntered(next)
    if (phase.kind === 'error' || phase.kind === 'wrong') setPhase({ kind: 'enter' })
    if (next.length === 4) void submit(next)
  }

  function undo() {
    if (busy || entered.length === 0) return
    setEntered((e) => e.slice(0, -1))
  }

  const wrong = phase.kind === 'wrong'
  const n = entered.length
  const prompt = phase.kind === 'ok' ? t.shell.pin.allMatch : t.shell.pin.prompt

  return (
    <div
      className="flex min-h-svh flex-col bg-bg text-fg"
      onKeyDown={(e) => {
        if (e.key === 'Backspace' && !(e.target instanceof HTMLInputElement)) {
          e.preventDefault()
          undo()
        }
      }}
    >
      <SignInBar grownUpHref={grownUpHref} />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pt-2 pb-10 md:px-10 lg:flex-row lg:gap-18 lg:pb-12">
        <section aria-label={t.shell.pin.signIn} className="flex w-full max-w-[440px] flex-col items-center gap-5 text-center lg:w-95 lg:flex-none lg:items-start lg:text-left">
          {data.avatar ? <Avatar name={data.avatar} size={120} title={avatarLabel(data.avatar, lang)} className="h-24 w-24 md:h-30 md:w-30" /> : null}
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-h1 font-bold break-words">{t.shell.hi(data.name)}</h1>
            <p className="m-0 text-body-lg text-fg-muted">{locked ? t.shell.pin.resting : prompt}</p>
          </div>
          {locked ? null : (
            <div className="flex items-center gap-5">
              <ol aria-label={t.shell.pin.chosen(n)} className="m-0 flex list-none gap-3.5 p-0">
                {[0, 1, 2, 3].map((i) => (
                  <li
                    key={i}
                    className={cx(
                      'h-8 w-8 rounded-pill border-2',
                      i < n ? 'border-fg bg-fg' : wrong ? 'border-warn bg-surface' : 'border-border bg-surface',
                    )}
                  />
                ))}
              </ol>
              <IconButton icon="backspace" label={t.shell.pin.removeLast} iconSize={26} disabled={n === 0 || busy} onClick={undo} />
            </div>
          )}
          <div aria-live="polite" className="contents">
            {phase.kind === 'checking' ? (
              <p role="status" className="m-0 inline-flex items-center gap-2 text-body-lg font-semibold">
                <UiIcon name="spinner" size={22} />
                {t.shell.pin.checking}
              </p>
            ) : null}
          </div>
          {wrong && !locked ? (
            <div role="alert" className="flex items-start gap-2.5 rounded-control border-2 border-warn bg-surface px-4 py-3 text-left text-body-lg font-semibold">
              <UiIcon name="replay" size={22} strokeWidth={2.5} className="mt-1 flex-none text-warn" />
              <span>
                {t.shell.pin.noMatch}
                {phase.left !== null ? ` ${t.shell.pin.triesLeft(phase.left)}` : ''}
              </span>
            </div>
          ) : null}
          {phase.kind === 'error' ? <ActionError message={phase.message} reference={phase.reference} className="text-left" /> : null}
          {phase.kind === 'ok' ? (
            <div role="status" className="flex flex-col items-center gap-3.5 lg:items-start">
              <p className="m-0 inline-flex items-center gap-2.5 text-body-lg font-bold">
                <UiIcon name="check-circle" size={24} strokeWidth={2.5} className="text-success" />
                {t.shell.pin.welcomeBack(data.name)}
              </p>
              <ButtonLink href={phase.redirectTo} iconAfter="arrow-right">
                {t.shell.goToToday}
              </ButtonLink>
            </div>
          ) : null}
          <Link href={pickHref} className="inline-flex min-h-11 items-center text-body font-semibold text-fg underline underline-offset-3">
            {t.shell.pin.notYou(data.name)}
          </Link>
        </section>

        {locked ? (
          <section role="alert" className="flex w-full max-w-[440px] flex-col items-center gap-3.5 rounded-card bg-surface shadow-soft px-6 py-9 text-center sm:px-8">
            <span className="flex h-24 w-24 items-center justify-center rounded-card border-2 border-fg bg-bg">
              <UiIcon name="lock" size={48} strokeWidth={1.75} />
            </span>
            <h2 className="m-0 font-display text-h1 font-semibold">{t.shell.pin.breakTitle}</h2>
            <p className="m-0 text-body-lg" suppressHydrationWarning>
              {t.shell.pin.tooManyTries(Math.max(1, Math.ceil(remaining / 60)))}
            </p>
            <Timer mode="countdown" seconds={remaining} warnAt={0} />
            <p className="m-0 text-body text-fg-muted">{t.shell.pin.grownUpCanEnd}</p>
            <ButtonLink href={grownUpHref}>{t.shell.askGrownUp}</ButtonLink>
          </section>
        ) : (
          <div role="group" aria-label={t.shell.pin.keys} className="grid w-full max-w-[440px] grid-cols-3 gap-3 sm:gap-4 lg:w-110 lg:flex-none">
            {data.pictures.map((p, i) => (
              <button
                key={p}
                ref={i === 0 ? firstKey : undefined}
                type="button"
                aria-label={t.shell.pin.pictures[p]}
                disabled={busy}
                onClick={() => pick(p)}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-card border-2 border-border bg-surface p-0 text-fg transition-transform duration-150 ease-kira hover:border-fg enabled:active:scale-97 disabled:cursor-progress"
              >
                <Icon name={p} size={64} className="h-12 w-12 sm:h-16 sm:w-16" />
                <span className="text-body font-bold">{t.shell.pin.pictures[p]}</span>
              </button>
            ))}
          </div>
        )}
      </main>
      <SiteFooter area="learner" />
    </div>
  )
}
