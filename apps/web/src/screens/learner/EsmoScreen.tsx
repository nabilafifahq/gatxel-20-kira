'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import type { EsmoActions, EsmoDTO, EsmoPack } from '@/lib/dto'
import { Button, ButtonLink, IconLink } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { UiIcon } from '@/components/ui/icons'
import { longDate } from '@/components/learner/format'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { SUBJECT_STYLE } from '@/components/learner/subject'
import { useLang, useT } from '@/lib/i18n/client'
import type { Dict } from '@/lib/i18n'
import { ActionError } from './common'

/**
 * L15 Paket ESMO (papan PaketEsmo, PaketEsmoBaru). Sepuluh paket latihan per mapel dan satu
 * mock test. Paket baru dimulai lewat startPack; paket yang berjalan atau selesai memakai
 * href dari DTO (lanjutkan atau lihat jawaban). DTO belum membawa jumlah soal per paket,
 * jadi skor ditulis sebagai angka saja.
 */

type Column = EsmoDTO['columns'][number]
type Failure = { message: string; reference: string }

function firstOpen(packs: EsmoPack[]): number {
  const going = packs.findIndex((p) => p.status === 'in-progress')
  if (going >= 0) return going
  const fresh = packs.findIndex((p) => p.status === 'new')
  return fresh >= 0 ? fresh : 0
}

function packAria(p: EsmoPack, t: Dict['arena']['esmo']): string {
  if (p.status === 'done') return t.packAriaDone(p.num, p.score)
  if (p.status === 'in-progress') return t.packAriaStarted(p.num, p.score)
  return t.packAriaNew(p.num)
}

function SubjectColumn({ col, actions }: { col: Column; actions: EsmoActions }): ReactElement {
  const dict = useT()
  const t = dict.arena.esmo
  const router = useRouter()
  const [sel, setSel] = useState(() => firstOpen(col.packs))
  const [busy, setBusy] = useState<'pack' | 'mock' | null>(null)
  const [error, setError] = useState<Failure | null>(null)
  const style = SUBJECT_STYLE[col.subject]
  const pack = col.packs[sel]

  const run = async (kind: 'pack' | 'mock') => {
    if (busy) return
    setBusy(kind)
    setError(null)
    try {
      const res = kind === 'pack' && pack ? await actions.startPack(pack.id) : await actions.startMock(col.subject)
      if (res.ok) {
        router.push(res.data.redirectTo)
        return
      }
      setError({ message: res.message, reference: res.reference })
    } catch {
      setError({ message: dict.arena.errors.thisPracticeNet, reference: 'KRA-ESMO-NET' })
    }
    setBusy(null)
  }

  const meta = !pack
    ? ''
    : pack.status === 'done'
      ? t.lastScore(pack.score ?? 0)
      : pack.status === 'in-progress'
        ? t.answered(pack.score ?? 0)
        : t.notStarted

  return (
    <section aria-labelledby={`esmo-${col.subject}`} className="flex min-w-0 flex-col gap-4 rounded-card bg-surface shadow-soft p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id={`esmo-${col.subject}`} className="m-0">
          <SubjectChip subject={col.subject} size="M" label={col.name} />
        </h2>
        <span className="min-w-0 text-body text-fg-muted">{col.langNote}</span>
        <span className="ml-auto flex-none text-body font-bold tabular-nums">{col.doneLine}</span>
      </div>
      <ol aria-label={t.packsAria(col.name, col.doneLine)} className="m-0 grid list-none grid-cols-5 gap-2.5 p-0">
        {col.packs.map((p, i) => {
          const on = i === sel
          return (
            <li key={p.id} className="flex min-w-0">
              <button
                type="button"
                aria-pressed={on}
                aria-label={packAria(p, t)}
                onClick={() => {
                  setSel(i)
                  setError(null)
                }}
                className={cx(
                  'flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-control p-0 text-fg md:h-24',
                  on ? cx('border-4', style.border, style.tint) : p.status === 'in-progress' ? cx('border-2 bg-surface', style.border) : 'border-2 border-border bg-surface hover:border-fg',
                )}
              >
                <span className="font-numbers text-h1 font-semibold tabular-nums">{p.num}</span>
                {p.status === 'done' ? (
                  <span className="inline-flex items-center gap-1 text-body font-bold tabular-nums">
                    <UiIcon name="check" size={16} strokeWidth={3} className="text-success" />
                    {p.score}
                  </span>
                ) : p.status === 'in-progress' ? (
                  <span className={cx('h-2 w-6 rounded-pill', style.bar)} />
                ) : (
                  <span className="text-body font-semibold text-fg-muted">{t.new}</span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
      {pack ? (
        <div className={cx('flex flex-wrap items-center gap-4 rounded-control p-4', style.tint)}>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-h3 font-bold">{t.practice(pack.num)}</span>
            <span className="text-body">{meta}</span>
          </div>
          {pack.status === 'new' ? (
            <Button onClick={() => void run('pack')} loading={busy === 'pack'} iconAfter="arrow-right">
              {dict.common.start}
            </Button>
          ) : (
            <ButtonLink href={pack.href} prefetch={false} iconAfter="arrow-right">
              {pack.status === 'done' ? t.seeAnswers : dict.common.continue}
            </ButtonLink>
          )}
        </div>
      ) : null}
      {error ? <ActionError message={error.message} reference={error.reference} /> : null}
      <div className="flex flex-wrap items-center gap-4 border-t border-divider pt-4">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-lg font-bold">{t.mock}</span>
          <span className="text-body text-fg-muted">{col.mockMeta}</span>
        </div>
        <Button variant="secondary" onClick={() => void run('mock')} loading={busy === 'mock'}>
          {t.startMock}
        </Button>
      </div>
    </section>
  )
}

export function EsmoScreen({ data, actions, backHref = LEARNER_ROUTES.today }: { data: EsmoDTO; actions: EsmoActions; backHref?: string }): ReactElement {
  const t = useT().arena.esmo
  const lang = useLang()
  const started = data.columns.some((c) => c.packs.some((p) => p.status !== 'new'))
  return (
    <LearnerFrame shell={data.shell} current={null} className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <IconLink href={backHref} icon="arrow-left" label={t.backToday} />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 text-h1 font-bold">{data.finalName}</h1>
          <p className="m-0 text-body-lg text-fg-muted">{started ? t.introStarted : t.introNew}</p>
        </div>
        {data.finalDate || data.daysToGo !== null ? (
          <div className="flex min-h-18 w-full flex-none items-center gap-3.5 rounded-card bg-surface shadow-soft px-5 lg:w-auto">
            <UiIcon name="trophy" size={28} className="flex-none" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body text-fg-muted">{t.final}</span>
              <span className="text-body font-bold">{data.finalDate ? (lang === 'en' ? longDate(data.finalDate) : data.finalDate) : t.dateToCome}</span>
            </div>
            {data.daysToGo !== null ? (
              <div className="flex items-baseline gap-2 border-l border-divider pl-3.5">
                <span className="font-numbers text-h1 font-semibold tabular-nums">{data.daysToGo}</span>
                <span className="text-body font-semibold">{t.daysToGo(data.daysToGo)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data.columns.map((c) => (
          <SubjectColumn key={c.subject} col={c} actions={actions} />
        ))}
      </div>

      <footer className="mt-auto flex items-center gap-3.5 rounded-card bg-surface shadow-soft px-5 py-4">
        <UiIcon name="info" size={24} className="flex-none" />
        <span className="text-body-lg">{t.footer}</span>
      </footer>
    </LearnerFrame>
  )
}
