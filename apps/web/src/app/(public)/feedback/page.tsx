import type { Metadata } from 'next'
import { ChildHelpScreen, FeedbackScreen } from '@/screens/public/FeedbackScreen'
import { safePagePath } from '@/lib/support'
import { appVersion } from '@/server/app-version'
import { getActor, homeFor } from '@/server/auth/actor'
import { turnstileSiteKey } from '@/server/auth/turnstile'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Bantuan dan masukan',
  description: 'Laporkan masalah, kirim saran, atau hubungi tim Kira di Gatxel lewat email dan WhatsApp.',
}

/** Bantuan untuk pengunjung, orang tua, dan tutor. Anak hanya melihat ajakan meminta bantuan orang tua. */
export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ dari?: string | string[] }> }) {
  const actor = await getActor()
  if (actor?.role === 'learner') return <ChildHelpScreen homeHref={homeFor('learner')} />
  const { dari } = await searchParams
  return (
    <FeedbackScreen
      viewer={actor ? { accountId: actor.userId, role: actor.role as 'tutor' | 'guardian', email: actor.email, homeHref: homeFor(actor.role) } : null}
      turnstileSiteKey={actor ? null : turnstileSiteKey()}
      appVersion={appVersion()}
      fromPath={safePagePath(typeof dari === 'string' ? dari : null)}
    />
  )
}
