import Link from 'next/link'
import { PREVIEWS, type PreviewArea } from './registry'

export const dynamic = 'force-dynamic'

const AREA_TITLE: Record<PreviewArea, string> = {
  console: 'Konsol tutor',
  family: 'Orang tua',
  public: 'Publik',
  print: 'Cetak A4',
}

/** Daftar pratinjau layar konsol, orang tua, publik, dan cetak, dengan semua state-nya. */
export default function ConsoleGallery() {
  const areas: PreviewArea[] = ['console', 'family', 'public', 'print']
  return (
    <main className="mx-auto flex max-w-[1120px] flex-col gap-8 px-4 py-8" data-area="console" lang="id">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-h1 font-bold">Pratinjau layar</h1>
        <p className="m-0 text-body text-fg-muted">
          Data contoh dari src/dev/fixtures (bertanda __GTX_SEED__). Action palsu selesai setelah 300 ms; state error memakai kode referensi <span className="whitespace-nowrap">DEV-0001</span>.
        </p>
      </header>
      {areas.map((area) => (
        <section key={area} aria-labelledby={`area-${area}`} className="flex flex-col gap-3">
          <h2 id={`area-${area}`} className="m-0 text-h2 font-bold">
            {AREA_TITLE[area]}
          </h2>
          <ul className="m-0 flex list-none flex-col rounded-card border border-divider bg-surface p-0">
            {PREVIEWS.filter((p) => p.area === area).map((p) => (
              <li key={p.name} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider px-5 py-3 last:border-b-0">
                <Link href={`/dev/konsol/${p.name}`} className="min-w-0 flex-[1_1_240px] text-body font-bold">
                  {p.title}
                </Link>
                <span className="text-small text-fg-muted">Papan {p.board}</span>
                <span className="flex flex-wrap gap-1.5">
                  {p.states.map((s) => (
                    <Link
                      key={s}
                      href={`/dev/konsol/${p.name}?state=${encodeURIComponent(s)}`}
                      className="inline-flex h-8 items-center rounded-pill border border-border px-3 text-small font-semibold text-fg no-underline hover:border-fg hover:text-fg"
                    >
                      {s}
                    </Link>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
