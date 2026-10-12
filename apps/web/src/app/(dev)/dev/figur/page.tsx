import { Figure } from '@kira/figures'

export const dynamic = 'force-dynamic'

/** Galeri figur. */
export default function FigureGallery() {
  return (
    <main className="mx-auto max-w-[1180px] p-8">
      <h1 className="text-h1 font-bold">Figur</h1>
      <Figure spec={{ kind: 'array', rows: 4, cols: 5, icon: 'apple', alt: '4 rows of 5 apples.' }} />
    </main>
  )
}
