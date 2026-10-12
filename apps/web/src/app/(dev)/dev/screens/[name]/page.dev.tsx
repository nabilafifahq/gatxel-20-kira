import { notFound } from 'next/navigation'
import {
  LEARNER_SCREENS,
  competitionIntroFixture,
  competitionPickFixture,
  correctionBookFixture,
  doneTodayFixture,
  esmoFixture,
  lessonFixture,
  mapFixture,
  meFixture,
  pickLearnerFixture,
  pinFixture,
  questIntroFixture,
  resultsFixture,
  reviewFixture,
  runnerFixture,
  todayFixture,
} from '@/dev/fixtures/learner'
import { ScreenPreview } from './preview'

export const dynamic = 'force-dynamic'

/**
 * Pratinjau layar learner dengan data contoh. `?state=` memilih varian fixture.
 * Data dibentuk di server (sama seperti halaman sungguhan), action palsu dibuat di client.
 */
export default async function ScreenPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { name } = await params
  const sp = await searchParams
  const meta = LEARNER_SCREENS[name]
  if (!meta) notFound()
  const raw = typeof sp.state === 'string' ? sp.state : undefined
  const state = raw && meta.states.includes(raw) ? raw : (meta.states[0] ?? 'normal')
  const data = fixture(name, state)
  if (data === null) notFound()
  // Tautan nomor soal dari halaman hasil: ?q=nomor membuka soal itu di pembahasan.
  const q = typeof sp.q === 'string' ? Number.parseInt(sp.q, 10) : Number.NaN
  if (name === 'review' && Number.isInteger(q) && q > 0) (data as { openPosition: number }).openPosition = q
  return <ScreenPreview name={name} state={state} data={data} />
}

function fixture(name: string, state: string): unknown {
  switch (name) {
    case 'pick-learner':
      return pickLearnerFixture(state)
    case 'pin':
      return pinFixture(state)
    case 'today':
      return todayFixture(state)
    case 'quest-intro':
      return questIntroFixture(state)
    case 'runner':
      return runnerFixture(state)
    case 'results':
      return resultsFixture(state)
    case 'review':
      return reviewFixture(state)
    case 'done-today':
      return doneTodayFixture(state)
    case 'map':
      return mapFixture(state)
    case 'me':
      return meFixture(state)
    case 'correction-book':
      return correctionBookFixture(state)
    case 'lesson':
      return lessonFixture(state)
    case 'competition-pick':
      return competitionPickFixture(state)
    case 'competition-intro':
      return competitionIntroFixture(state)
    case 'esmo':
      return esmoFixture(state)
    default:
      return null
  }
}
