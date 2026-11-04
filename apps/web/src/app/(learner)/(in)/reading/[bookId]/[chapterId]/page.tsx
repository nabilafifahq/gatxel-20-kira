import { notFound } from 'next/navigation'
import { ReaderScreen } from '@/screens/learner/ReaderScreen'
import { inOrg } from '@/server/db'
import { orgCtx, pageActor } from '@/server/auth/actor'
import { logReadingTimeAction, saveReadingProgressAction, skipChapterQuizAction, startChapterQuizAction, submitChapterQuizAction } from '@/server/actions/reading'
import { isFeatureOn } from '@/server/dal/learner-features'
import { readerDTO } from '@/server/dal/reading-room'
import { load } from '@/server/page'

export const dynamic = 'force-dynamic'

export default async function ReaderPage({ params }: { params: Promise<{ bookId: string; chapterId: string }> }) {
  const { bookId, chapterId } = await params
  const actor = await pageActor(['learner'])
  if (!(await isFeatureOn(actor.userId, 'reading-room'))) notFound()
  const data = await load(() => inOrg(orgCtx(actor), (tx) => readerDTO(tx, actor.userId, bookId, chapterId)))
  return (
    <ReaderScreen
      data={data}
      actions={{
        saveProgress: saveReadingProgressAction,
        logTime: logReadingTimeAction,
        startQuiz: startChapterQuizAction,
        submitQuiz: submitChapterQuizAction,
        skipQuiz: skipChapterQuizAction,
      }}
    />
  )
}
