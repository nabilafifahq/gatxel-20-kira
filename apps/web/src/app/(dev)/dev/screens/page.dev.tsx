import Link from 'next/link'
import { LEARNER_SCREENS } from '@/dev/fixtures/learner'

export const dynamic = 'force-dynamic'

/** Daftar layar learner dan state fixture-nya (__GTX_SEED__). */
export default function ScreensIndex() {
  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">Layar learner</h1>
        <p className="m-0 text-body text-fg-muted">
          Data contoh dan action palsu (selesai setelah 300 ms). Komponen satuan ada di <Link href="/dev/ui">/dev/ui</Link>.
        </p>
      </header>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {Object.entries(LEARNER_SCREENS).map(([name, meta]) => (
          <li key={name} className="flex flex-col gap-2 rounded-card border border-divider bg-surface p-4">
            <span className="text-body-lg font-bold">{meta.title}</span>
            <span className="flex flex-wrap gap-2">
              {meta.states.map((st) => (
                <Link
                  key={st}
                  href={`/dev/screens/${name}?state=${st}`}
                  className="inline-flex h-9 items-center rounded-pill border border-border px-3.5 text-body font-semibold text-fg no-underline hover:border-fg"
                >
                  {st}
                </Link>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </main>
  )
}
