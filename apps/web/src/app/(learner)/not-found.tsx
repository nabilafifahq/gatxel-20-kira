import { KiraStar } from '@/components/ui/KiraStar'
import { LEARNER_ROUTES } from '@/components/learner/routes'
import { ButtonLink } from '@/components/ui/Button'
import { getT } from '@/lib/i18n/server'

/**
 * Halaman yang tidak ada atau fitur yang dimatikan orang tua (notFound() dari gerbang saklar).
 * Tanpa berkas ini anak melihat layar 404 bawaan Next.js tanpa jalan kembali.
 */
export default async function LearnerNotFound() {
  const t = await getT()
  return (
    <main className="mx-auto flex min-h-svh max-w-[560px] flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-fg">
      <KiraStar size={96} mood="calm" />
      <h1 className="m-0 font-display text-h1 font-bold">{t.shell.notFound.title}</h1>
      <p className="m-0 text-body-lg">{t.shell.notFound.body}</p>
      <ButtonLink href={LEARNER_ROUTES.today} iconAfter="arrow-right">
        {t.shell.routeError.home}
      </ButtonLink>
    </main>
  )
}
