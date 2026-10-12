import type { PrintLjkDTO } from '@/lib/dto'
import { PrintSheet, PrintStyles } from '@/components/print/PrintSheet'
import { PrintToolbar } from '@/components/print/PrintToolbar'

/**
 * C02 Lembar jawaban komputer A4 (papan LjkA4). Komponen server.
 * Empat tanda sudut untuk pemindaian, kode QR dari server, kisi bulatan per nomor,
 * dan kotak isian untuk nomor isian. Tidak ada kolom nama: QR menghubungkan
 * lembar ke learner di Kira.
 */

const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const

function Bubble({ children, filled }: { children?: string; filled?: boolean }) {
  return (
    <span
      className={`inline-flex size-5 flex-none items-center justify-center rounded-pill border-[1.5px] border-fg text-small leading-none font-semibold ${filled ? 'bg-fg' : 'bg-white'}`}
    >
      {children}
    </span>
  )
}

export function PrintLjk({ data }: { data: PrintLjkDTO }) {
  const n = Math.max(1, data.questionCount)
  const columns = n <= 20 ? 2 : 4
  const perCol = Math.ceil(n / columns)
  const letters = LETTERS.slice(0, data.optionCount)
  const cols = Array.from({ length: columns }, (_, c) => Array.from({ length: perCol }, (_, r) => c * perCol + r + 1).filter((x) => x <= n)).filter((c) => c.length)
  const rowGap = perCol > 15 ? 'gap-1.5' : 'gap-2'

  return (
    <div className="print-stack">
      <PrintStyles />
      <PrintToolbar note={`LJK ${data.code}`} />
      <PrintSheet code={data.code} accent={null} page={1} pages={1} footerLabel={`${data.code}, Kira answer sheet, version 1`} bare>
        {/* Tanda sudut untuk pemindaian, 10,6 mm dari tepi kertas */}
        <span aria-hidden="true" className="absolute top-[10.6mm] left-[10.6mm] size-4 bg-fg" />
        <span aria-hidden="true" className="absolute top-[10.6mm] right-[10.6mm] size-4 bg-fg" />
        <span aria-hidden="true" className="absolute bottom-[10.6mm] left-[10.6mm] size-4 bg-fg" />
        <span aria-hidden="true" className="absolute right-[10.6mm] bottom-[10.6mm] size-4 bg-fg" />
        <div className="flex min-h-0 flex-1 flex-col gap-5 pt-4">

          <header className="flex items-start gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="font-display text-h2 leading-7 font-bold">Kira</span>
              <h1 className="m-0 text-h1 font-bold">Answer sheet</h1>
              <p className="m-0 text-body">
                {data.title}, {n} questions
              </p>
              <span className="mt-1 self-start rounded-sm border-2 border-fg px-3 py-1 font-display text-h3 leading-[26px] font-semibold tabular">{data.code}</span>
            </div>
            <img src={data.qrDataUrl} alt={`QR code for answer sheet ${data.code}`} width={120} height={120} className="size-[120px] flex-none [image-rendering:pixelated]" />
          </header>

          <div className="flex flex-col gap-2.5 rounded-control border border-fg-muted px-4 py-3.5 text-body">
            <span>
              Fill one circle for each question with a dark pencil. To change an answer, rub it out fully.
              {data.shortAnswerFrom ? ` From question ${data.shortAnswerFrom}, write the answer in the box.` : ''}
            </span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
              <span className="font-bold">Like this</span>
              <span className="inline-flex gap-1">
                <Bubble>A</Bubble>
                <Bubble filled />
                <Bubble>C</Bubble>
              </span>
              <span className="font-bold">Not like this</span>
              <span className="inline-flex gap-1" aria-label="A tick, a cross, and a half-filled circle">
                <span className="inline-flex size-5 items-center justify-center rounded-pill border-[1.5px] border-fg">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span className="inline-flex size-5 items-center justify-center rounded-pill border-[1.5px] border-fg">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </span>
                <span className="inline-flex size-5 overflow-hidden rounded-pill border-[1.5px] border-fg">
                  <span className="h-full w-1/2 bg-fg" />
                </span>
              </span>
            </div>
            <span className="text-fg-muted">There is no name on this sheet. The QR code links it to the learner in Kira.</span>
          </div>

          <div className={`grid gap-6 ${columns === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
            {cols.map((c, ci) => (
              <ol key={ci} className={`m-0 flex list-none flex-col border-t-2 border-fg p-0 pt-2.5 ${rowGap}`} aria-label={`Questions ${c[0]} to ${c[c.length - 1]}`}>
                {c.map((num) => {
                  const short = data.shortAnswerFrom != null && num >= data.shortAnswerFrom
                  return (
                    <li key={num} className="flex items-center gap-1.5">
                      <span className="w-6 text-right text-small leading-5 font-bold tabular">{num}</span>
                      {short ? (
                        <span aria-label={`Answer box for question ${num}`} role="img" className="h-6 min-w-0 flex-1 rounded-sm border-[1.5px] border-fg" />
                      ) : (
                        letters.map((L) => <Bubble key={L}>{L}</Bubble>)
                      )}
                    </li>
                  )
                })}
              </ol>
            ))}
          </div>
        </div>
      </PrintSheet>
    </div>
  )
}
