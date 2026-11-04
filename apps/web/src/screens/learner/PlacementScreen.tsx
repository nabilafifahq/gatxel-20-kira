'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactElement } from 'react'
import type { ActionResult } from '@/lib/dto'
import type { PlacementAnswerResultDTO, PlacementEntryDTO, PlacementStepDTO } from '@/lib/dto-placement'
import { useT } from '@/lib/i18n/client'
import { Button, ButtonLink } from '@/components/ui/Button'
import { UiIcon } from '@/components/ui/icons'
import { useMediaQuery } from '@/components/learner/hooks'
import { Mascot } from '@/components/learner/Mascot'
import { ReadAloudButton } from '@/components/learner/ReadAloudButton'
import { playSfx, primeSfx } from '@/components/learner/sfx'
import { SubjectChip } from '@/components/learner/SubjectChip'
import { isAnswerComplete } from '@/components/widgets/answers'
import { QuestionView } from '@/components/widgets/QuestionView'
import { speakableClipParts, speakableStyle } from '@/components/widgets/speakable-parts'
import { Widget } from '@/components/widgets/Widget'

/**
 * Tes penempatan (learner, en-GB): ramah dan tanpa tekanan. Tidak ada jam, tidak ada skor, tidak ada benar atau salah
 * di layar. Satu soal sekali tampil, "I'm not sure" selalu boleh, dan anak boleh berhenti kapan saja (tes bisa dilanjutkan).
 */

export type PlacementActions = {
  answer(input: { runId: string; ref: string; answer?: unknown; unsure: boolean }): Promise<ActionResult<PlacementAnswerResultDTO>>
  skip(input: { subject: PlacementStepDTO['subject'] }): Promise<ActionResult<{ redirectTo: string }>>
}

function Frame({ jenjang, children }: { jenjang: string; children: React.ReactNode }): ReactElement {
  return (
    <div data-jenjang={jenjang} className="flex min-h-svh flex-col items-center bg-bg px-4 py-8 text-fg md:px-8 md:py-12">
      <div className="flex w-full max-w-[720px] flex-1 flex-col gap-6">{children}</div>
    </div>
  )
}

export function PlacementScreen({ entry, actions }: { entry: PlacementEntryDTO; actions: PlacementActions }): ReactElement {
  const t = useT()
  const copy = t.lessons.placement
  const router = useRouter()
  const [step, setStep] = useState<PlacementStepDTO | null>(entry.kind === 'step' ? entry.step : null)
  const [intro, setIntro] = useState(entry.kind === 'step' && entry.step.number === 1)
  const [done, setDone] = useState<Extract<PlacementAnswerResultDTO, { done: true }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const narrow = useMediaQuery('(max-width: 639px)')
  const [value, setValue] = useState<unknown | null>(null)
  useEffect(() => primeSfx(), [])

  if (entry.kind === 'nothing') {
    return (
      <Frame jenjang={entry.jenjang}>
        <Mascot name={entry.avatar} size={96} />
        <h1 className="m-0 font-display text-h1 font-semibold">{copy.nothingTitle}</h1>
        <p className="m-0 text-body-lg text-fg-muted">{copy.nothingNote}</p>
        <ButtonLink href="/today">{copy.goToToday}</ButtonLink>
      </Frame>
    )
  }

  if (entry.kind === 'pick') {
    return (
      <Frame jenjang={entry.jenjang}>
        <Mascot name={entry.avatar} size={96} />
        <h1 className="m-0 font-display text-h1 font-semibold">{copy.pickTitle}</h1>
        <p className="m-0 text-body-lg text-fg-muted">{copy.pickNote}</p>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {entry.subjects.map((s) => (
            <li key={s.subject}>
              <ButtonLink href={`/placement?subject=${s.subject}`} variant="secondary" className="w-full justify-between">
                <SubjectChip subject={s.subject} size="S" label={t.common.subject[s.subject]} />
                <span className="text-body text-fg-muted">{s.status === 'in_progress' ? copy.carryOn : t.common.start}</span>
              </ButtonLink>
            </li>
          ))}
        </ul>
        <Link href="/today" className="inline-flex h-11 items-center self-start text-body font-bold">
          {t.lessons.backToToday}
        </Link>
      </Frame>
    )
  }

  if (done) {
    return (
      <Frame jenjang={done.jenjang}>
        <Mascot name={done.avatar} mood="celebrate" size={112} />
        <h1 className="m-0 font-display text-h1 font-semibold">{copy.doneTitle}</h1>
        <p className="m-0 text-body-lg text-fg-muted">
          {copy.doneNote(t.common.subject[done.subject])}
        </p>
        {done.nextSubject ? (
          <ButtonLink href={`/placement?subject=${done.nextSubject}`} iconAfter="arrow-right">
            {copy.nextSubject(t.common.subject[done.nextSubject])}
          </ButtonLink>
        ) : (
          <ButtonLink href="/today" iconAfter="arrow-right">
            {copy.goToToday}
          </ButtonLink>
        )}
        {done.nextSubject ? (
          <Link href="/today" className="inline-flex h-11 items-center self-start text-body font-bold">
            {t.lessons.backToToday}
          </Link>
        ) : null}
      </Frame>
    )
  }

  if (!step) return <Frame jenjang="3-4">{null}</Frame>

  const skipTest = async () => {
    setBusy(true)
    const r = await actions.skip({ subject: step.subject })
    if (r.ok) router.push(r.data.redirectTo)
    else {
      setBusy(false)
      setError(r.message)
    }
  }

  if (intro) {
    return (
      <Frame jenjang={step.jenjang}>
        <Mascot name={step.avatar} size={112} />
        <SubjectChip subject={step.subject} size="S" label={copy.chip(t.common.subject[step.subject])} />
        <h1 className="m-0 font-display text-h1 font-semibold">{copy.introTitle}</h1>
        <p className="m-0 text-body-lg">{copy.introNote}</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-body-lg text-fg-muted">
          <li>{copy.introLength}</li>
          <li>{copy.introNoScore}</li>
          <li>{copy.introUnsure}</li>
          <li>{copy.introStop}</li>
        </ul>
        {error ? (
          <p role="alert" className="m-0 text-body font-semibold">
            {error}
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button onClick={() => (playSfx('tap'), setIntro(false))} iconAfter="arrow-right">
            {t.common.start}
          </Button>
          <ButtonLink href="/today" variant="quiet">
            {copy.notNow}
          </ButtonLink>
          <Button variant="quiet" size="M" loading={busy} onClick={() => void skipTest()} className="sm:ml-auto">
            {copy.skipTest}
          </Button>
        </div>
      </Frame>
    )
  }

  const item = step.item
  const complete = isAnswerComplete(item, value)
  const progress = Math.min(100, Math.round(((step.number - 1) / step.about) * 100))

  const submit = async (unsure: boolean) => {
    if (busy) return
    setBusy(true)
    setError(null)
    playSfx('tap')
    try {
      const r = await actions.answer({ runId: step.runId, ref: item.ref, ...(unsure ? {} : { answer: value }), unsure })
      if (!r.ok) {
        setError(copy.notSaved)
        return
      }
      if (r.data.done) setDone(r.data)
      else {
        setStep(r.data.step)
        setValue(null)
      }
    } catch {
      setError(copy.notSaved)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-jenjang={step.jenjang} className="flex min-h-svh flex-col bg-bg text-fg">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 md:px-8">
        <SubjectChip subject={step.subject} size="S" label={copy.chip(t.common.subject[step.subject])} />
        <div role="img" aria-label={copy.progress} className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-divider max-sm:order-last max-sm:basis-full">
          <span className="bg-fg transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
        <Link href="/today" className="inline-flex h-11 flex-none items-center gap-1 px-2 text-body font-bold max-sm:ml-auto max-sm:px-0">
          <UiIcon name="close" size={20} />
          {copy.stopForNow}
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-[1100px] flex-1 grid-cols-1 gap-4 px-4 pb-4 md:px-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section aria-label={copy.question} className="rounded-card border border-divider bg-surface p-4 md:p-8">
          <QuestionView
            key={item.ref}
            item={item}
            number={step.number}
            subject={step.subject}
            hideTools
            answer={{ value, onChange: (v) => !busy && setValue(v), disabled: busy, feedback: null }}
          />
        </section>
        <section aria-label={copy.yourAnswer} className="flex flex-col items-center justify-center gap-3.5 py-1">
          <Widget item={item} value={value} onChange={(v) => !busy && setValue(v)} disabled={busy} feedback={null} subject={step.subject} />
        </section>
      </main>
      {error ? (
        <p role="alert" className="m-0 px-4 pb-2 text-center text-body font-semibold md:px-8">
          {error}
        </p>
      ) : null}
      <footer className="sticky bottom-0 z-10 flex items-center gap-2 bg-bg sm:gap-3 px-4 py-3 md:px-8">
        <ReadAloudButton text={speakableClipParts(item)} style={speakableStyle(item)} lang={item.lang} subject={step.subject} showNote={false} compact={narrow} />
        <Button variant="secondary" onClick={() => void submit(true)} disabled={busy} className="ml-auto max-sm:px-3">
          {copy.notSure}
        </Button>
        <Button onClick={() => void submit(false)} disabled={!complete || busy} loading={busy} className="max-sm:px-3" {...(narrow ? {} : { iconAfter: 'arrow-right' as const })}>
          {t.common.next}
        </Button>
      </footer>
    </div>
  )
}
