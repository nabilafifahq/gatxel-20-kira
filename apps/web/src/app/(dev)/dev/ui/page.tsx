import { allWidgetItems } from '@/dev/fixtures/learner-items'
import { reviewFixture, STREAK } from '@/dev/fixtures/learner'
import { Gallery } from './gallery'

export const dynamic = 'force-dynamic'

/**
 * Galeri komponen learner dengan semua state-nya. Data contoh (__GTX_SEED__) dibentuk di
 * server seperti halaman sungguhan, lalu galeri interaktif dirender di client.
 */
export default function LearnerGallery() {
  const items = allWidgetItems()
  const solution = reviewFixture('solution').questions.find((q) => q.solution)
  return <Gallery items={items} streak={STREAK} solution={solution?.solution ?? []} solutionFigure={solution?.item.figure ?? null} />
}
