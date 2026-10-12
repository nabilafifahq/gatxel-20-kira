'use client'

import { useMemo, type ReactElement } from 'react'
import type {
  ActionResult,
  AnswerResult,
  CompetitionIntroDTO,
  CompetitionPickDTO,
  CorrectionBookDTO,
  DoneTodayDTO,
  EsmoDTO,
  LessonDTO,
  MapDTO,
  MeDTO,
  PickLearnerDTO,
  PinPicture,
  PinScreenDTO,
  QuestIntroDTO,
  ResultsDTO,
  ReviewDTO,
  RunnerDTO,
  TodayDTO,
} from '@/lib/dto'
import { DEV_PIN } from '@/dev/fixtures/learner'
import { CompetitionIntroScreen } from '@/screens/learner/CompetitionIntroScreen'
import { CompetitionPickScreen } from '@/screens/learner/CompetitionPickScreen'
import { CorrectionBookScreen } from '@/screens/learner/CorrectionBookScreen'
import { DoneTodayScreen } from '@/screens/learner/DoneTodayScreen'
import { EsmoScreen } from '@/screens/learner/EsmoScreen'
import { LessonScreen } from '@/screens/learner/LessonScreen'
import { MapScreen } from '@/screens/learner/MapScreen'
import { MeScreen } from '@/screens/learner/MeScreen'
import { PickLearnerScreen } from '@/screens/learner/PickLearnerScreen'
import { PinScreen } from '@/screens/learner/PinScreen'
import { QuestIntroScreen } from '@/screens/learner/QuestIntroScreen'
import { ResultsScreen } from '@/screens/learner/ResultsScreen'
import { ReviewScreen } from '@/screens/learner/ReviewScreen'
import { RunnerScreen } from '@/screens/learner/RunnerScreen'
import { TodayScreen } from '@/screens/learner/TodayScreen'

// __GTX_SEED__ action palsu untuk pratinjau: selesai setelah 300 ms.

const DEV = '/dev/screens'

function later<T>(data: T, ms = 300): Promise<ActionResult<T>> {
  return new Promise((resolve) => window.setTimeout(() => resolve({ ok: true, data }), ms))
}

function fail<T>(message: string, extra: { reference?: string; fieldErrors?: Record<string, string> } = {}, ms = 300): Promise<ActionResult<T>> {
  return new Promise((resolve) =>
    window.setTimeout(() => resolve({ ok: false, message, reference: extra.reference ?? 'DEV-0001', ...(extra.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}) }), ms),
  )
}

/** PIN palsu: kucing, bintang, apel, perahu. Sisa percobaan berkurang di memori halaman. */
function pinActions(d: PinScreenDTO) {
  let left = d.attemptsLeft > 0 ? d.attemptsLeft : 3
  return {
    submitPin: (_id: string, pin: PinPicture[]) => {
      if (pin.join() === DEV_PIN.join()) return later({ redirectTo: `${DEV}/today` })
      left -= 1
      if (left <= 0) {
        left = 3
        return fail<{ redirectTo: string }>('Too many tries.', { reference: 'DEV-PIN-0003', fieldErrors: { lockedUntil: new Date(Date.now() + 15 * 60_000).toISOString() } })
      }
      return fail<{ redirectTo: string }>('Those pictures do not match.', { reference: 'DEV-PIN-0002', fieldErrors: { attemptsLeft: String(left) } })
    },
  }
}

function PinPreview({ d }: { d: PinScreenDTO }): ReactElement {
  const actions = useMemo(() => pinActions(d), [d])
  return <PinScreen data={d} actions={actions} pickHref={`${DEV}/pick-learner`} />
}

export function ScreenPreview({ name, state, data }: { name: string; state: string; data: unknown }): ReactElement {
  switch (name) {
    case 'pick-learner':
      return <PickLearnerScreen data={data as PickLearnerDTO} pinHref={() => `${DEV}/pin`} />
    case 'pin':
      return <PinPreview d={data as PinScreenDTO} />
    case 'today':
      return <TodayScreen data={data as TodayDTO} doneHref={`${DEV}/done-today?state=time-limit`} />
    case 'quest-intro':
      return <QuestIntroScreen data={data as QuestIntroDTO} backHref={`${DEV}/today`} online={state === 'missing' ? false : undefined} />
    case 'results':
      return <ResultsScreen data={data as ResultsDTO} />
    case 'review':
      return <ReviewScreen data={data as ReviewDTO} />
    case 'done-today':
      return <DoneTodayScreen data={data as DoneTodayDTO} todayHref={`${DEV}/today`} />
    case 'map':
      return <MapScreen data={data as MapDTO} />
    case 'me':
      return <MeScreen data={data as MeDTO} actions={{ changeAvatar: (a) => (a === 'frog' ? fail('The avatar was not saved.') : later(undefined)) }} />
    case 'correction-book':
      return <CorrectionBookScreen data={data as CorrectionBookDTO} todayHref={`${DEV}/today`} />
    case 'lesson':
      return <LessonScreen data={data as LessonDTO} actions={{ completeLesson: () => later(undefined) }} />
    case 'competition-pick':
      return <CompetitionPickScreen data={data as CompetitionPickDTO} />
    case 'competition-intro':
      return (
        <CompetitionIntroScreen
          data={data as CompetitionIntroDTO}
          backHref={`${DEV}/competition-pick`}
          actions={{ startSimulation: () => later({ redirectTo: `${DEV}/runner?state=esmo-mock` }) }}
        />
      )
    case 'esmo':
      return (
        <EsmoScreen
          data={data as EsmoDTO}
          backHref={`${DEV}/today`}
          actions={{
            startPack: () => later({ redirectTo: `${DEV}/runner?state=esmo-practice` }),
            startMock: (subject) => (subject === 'english' ? fail('The English mock test is not ready yet.') : later({ redirectTo: `${DEV}/runner?state=esmo-mock` })),
          }}
        />
      )
    case 'runner': {
      const d = data as RunnerDTO
      const broken = state === 'save-error'
      return (
        <RunnerScreen
          data={d}
          actions={{
            saveAnswer: () => (broken ? fail<AnswerResult>('The answer did not reach the server.') : later<AnswerResult>({ status: 'answered', xp: 0 })),
            submitAttempt: () => later({ redirectTo: d.mode === 'simulasi' || d.kind === 'test' ? `${DEV}/results?state=esmo` : `${DEV}/results` }),
            reportProblem: () => later({ reference: 'DEV-RPT-0042' }),
          }}
          onUpload={() => later({ mediaId: 'dev-media-0001' }, 600).then((r) => (r.ok ? r.data : null))}
        />
      )
    }
    default:
      return <p className="p-8 text-body-lg">Layar {name} belum tersedia.</p>
  }
}
