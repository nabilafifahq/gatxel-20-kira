import type { ReactNode } from 'react'
import { Figure } from '@kira/figures'
import type { FigureSpec } from '@kira/figures/spec'
import type { ClientItem } from '@kira/content/present'

/**
 * Soal sebagai tampilan statis (papan PaperA4Hal1, PaperA4Hal2), untuk kertas cetak
 * dan pratinjau di konsol. Pilihan ganda menjadi baris berhuruf, isian menjadi kotak
 * jawaban, urutkan, jodohkan, dan kelompokkan menjadi daftar dengan kotak.
 * Tidak memakai state atau event, jadi bisa dirender di server.
 */

export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

type Variant = 'print' | 'screen'

function Box({ w = 76, h = 42, label }: { w?: number; h?: number; label?: string }) {
  return (
    <span
      aria-label={label}
      role={label ? 'img' : undefined}
      className="inline-block flex-none rounded-control border-2 border-fg bg-white"
      style={{ width: w, height: h }}
    />
  )
}

function AnswerLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-body font-semibold">
      {label}
      {children}
    </div>
  )
}

function WorkBox({ height = 140 }: { height?: number }) {
  return (
    <div className="paper-grid relative min-w-0 flex-1 rounded-control border border-fg-muted" style={{ minHeight: height }}>
      <span className="absolute top-2 left-2.5 bg-white px-1 text-small font-semibold text-fg-muted">Working</span>
    </div>
  )
}

function Lines({ count, gap = 32 }: { count: number; gap?: number }) {
  return (
    <div className="flex flex-col" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="block border-b border-fg-muted" style={{ height: gap }} />
      ))}
    </div>
  )
}

function ruledLines(item: ClientItem): number {
  const words = item.maxWords ?? item.minWords ?? 30
  return Math.min(12, Math.max(4, Math.ceil(words / 7)))
}

/** Figur tambahan untuk tipe yang bentuknya datang dari data soal, bukan dari `figure`. */
function derivedFigure(item: ClientItem): FigureSpec | null {
  if (item.figure) return null
  if (item.type === 'numberline' && item.numberline) {
    const { min, max, step } = item.numberline
    return { kind: 'numberline', min, max, step, labels: 'ends', alt: `Number line from ${min} to ${max}.` }
  }
  if (item.type === 'fraction' && item.fraction) {
    return { kind: 'fraction', shape: item.fraction.shape, parts: item.fraction.parts, shaded: 0, alt: `A ${item.fraction.shape} split into ${item.fraction.parts} equal parts.` }
  }
  if (item.type === 'clock') {
    return { kind: 'clock', h: 12, m: 0, showNumbers: true, digital: false, alt: 'A clock face with no hands, to draw the time.' }
  }
  return null
}

export function ItemStatic({
  item,
  variant = 'print',
  workBox,
  showKey,
}: {
  item: ClientItem
  variant?: Variant
  /** Kotak kerja berpetak di samping figur (Math). */
  workBox?: boolean
  /** Untuk pratinjau konsol: tampilkan jawaban di bawah soal. */
  showKey?: { answerText: string; explanation?: string } | null
}) {
  const fig = item.figure ?? derivedFigure(item)
  const promptCls = variant === 'print' ? 'font-reading text-h3 leading-[30px]' : 'font-reading text-body-lg'
  const optionText = 'font-reading text-body-lg'
  const numericLike = item.type === 'numeric' || item.type === 'clock' || item.type === 'numberline' || item.type === 'fraction'

  return (
    <div lang={item.lang} className="flex min-w-0 flex-col gap-3">
      {item.prompt ? <p className={`m-0 ${promptCls}`}>{item.prompt}</p> : null}

      {item.passage ? (
        <div className="rounded-control border border-fg-muted px-4 py-3">
          <p className="m-0 mb-1 text-body font-bold">{item.passage.title}</p>
          <p className={`m-0 whitespace-pre-line ${optionText}`}>{item.passage.text}</p>
        </div>
      ) : null}

      {item.readText ? <p className={`m-0 rounded-control border border-fg-muted px-4 py-3 ${optionText}`}>{item.readText}</p> : null}

      {fig || (workBox && numericLike) ? (
        <div className="flex flex-wrap items-stretch gap-5">
          {fig ? (
            <div className="flex-none rounded-control border border-fg-muted p-2" style={{ width: variant === 'print' ? 256 : 'min(100%, 340px)' }}>
              <Figure spec={fig} maxWidth={variant === 'print' ? 240 : 324} />
            </div>
          ) : null}
          {workBox && numericLike ? <WorkBox /> : null}
        </div>
      ) : null}

      {(item.type === 'mcq' || item.type === 'multi') && item.options ? (
        <>
          {item.type === 'multi' ? <p className="m-0 text-body font-semibold">Choose {item.multiCount ?? 2} answers.</p> : null}
          <ol className={`m-0 grid list-none gap-x-6 gap-y-2.5 p-0 ${item.options.some((o) => o.figure) ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {item.options.map((o, i) => (
              <li key={o.i} className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 inline-flex size-7 flex-none items-center justify-center rounded-pill border-2 border-fg text-body font-bold">
                  {OPTION_LETTERS[i]}
                </span>
                {o.figure ? (
                  <span className="min-w-0 flex-1 rounded-control border border-fg-muted p-1.5">
                    <Figure spec={o.figure} maxWidth={variant === 'print' ? 150 : 180} />
                  </span>
                ) : (
                  <span className={`min-w-0 ${optionText}`}>{o.text}</span>
                )}
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {item.type === 'numeric' ? (
        <AnswerLine label="Answer">
          <Box w={item.allowDecimal ? 110 : 90} label="Answer box" />
          {item.unit ? <span className="font-reading text-body-lg">{item.unit}</span> : null}
        </AnswerLine>
      ) : null}

      {item.type === 'text' ? (
        (item.blanks ?? 1) > 1 ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-body font-semibold">
            Answers
            {Array.from({ length: item.blanks ?? 1 }, (_, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                <span className="text-small text-fg-muted tabular">{i + 1}</span>
                <Box w={120} label={`Answer box ${i + 1}`} />
              </span>
            ))}
          </div>
        ) : (
          <AnswerLine label="Answer">
            <Box w={240} label="Answer box" />
          </AnswerLine>
        )
      ) : null}

      {item.type === 'clock' ? (
        <AnswerLine label="Time">
          <Box w={60} label="Hours" />
          <span className="text-h2 font-bold">:</span>
          <Box w={60} label="Minutes" />
        </AnswerLine>
      ) : null}

      {item.type === 'numberline' ? <p className="m-0 text-body font-semibold">Mark your answer on the number line.</p> : null}
      {item.type === 'fraction' ? <p className="m-0 text-body font-semibold">Shade the shape.</p> : null}

      {item.type === 'order' && item.orderItems ? (
        <>
          <p className="m-0 text-body font-semibold">Write 1, 2, 3 in the boxes to show the order.</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {item.orderItems.map((o) => (
              <li key={o.i} className="flex items-center gap-3">
                <Box w={44} h={38} label="Order box" />
                <span className={optionText}>{o.text}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {item.type === 'match' && item.matchLeft && item.matchRight ? (
        <>
          <p className="m-0 text-body font-semibold">Write the letter of the match in each box.</p>
          <div className="grid grid-cols-2 gap-6">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {item.matchLeft.map((l, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className={`min-w-0 flex-1 ${optionText}`}>
                    {i + 1}. {l}
                  </span>
                  <Box w={44} h={38} label="Letter box" />
                </li>
              ))}
            </ul>
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {item.matchRight.map((r, i) => (
                <li key={r.i} className="flex min-h-[38px] items-center gap-2.5">
                  <span className="inline-flex size-7 flex-none items-center justify-center rounded-pill border-2 border-fg text-body font-bold">
                    {OPTION_LETTERS[i]}
                  </span>
                  <span className={optionText}>{r.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : null}

      {item.type === 'sort' && item.sortGroups && item.sortItems ? (
        <>
          <p className="m-0 text-body font-semibold">
            Write the group letter in each box:{' '}
            {item.sortGroups.map((g, i) => `${OPTION_LETTERS[i]} = ${g}`).join(', ')}.
          </p>
          <ul className="m-0 grid list-none grid-cols-2 gap-x-6 gap-y-2 p-0">
            {item.sortItems.map((s) => (
              <li key={s.i} className="flex items-center gap-3">
                <Box w={44} h={38} label="Group box" />
                <span className={optionText}>{s.text}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {item.type === 'write' ? (
        <>
          {item.planning && item.planning.length ? (
            <ul className="m-0 flex flex-col gap-1 pl-5 text-body">
              {item.planning.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
          <Lines count={ruledLines(item)} />
          {item.minWords ? <p className="m-0 text-small text-fg-muted">Write at least {item.minWords} words.</p> : null}
        </>
      ) : null}

      {item.type === 'draw' ? (
        <div
          className={`rounded-control border border-fg-muted ${variant === 'print' ? 'h-[200px]' : 'h-[240px]'} ${item.drawBackground === 'grid' ? 'paper-grid' : 'bg-white'}`}
          style={
            item.drawBackground === 'dots'
              ? { backgroundImage: 'radial-gradient(var(--color-border) 1.3px, transparent 1.6px)', backgroundSize: '20px 20px', backgroundPosition: '10px 10px' }
              : item.drawBackground === 'lines'
                ? { backgroundImage: 'repeating-linear-gradient(transparent 0 31px, var(--color-divider) 31px 32px)' }
                : undefined
          }
          aria-label="Drawing box"
          role="img"
        />
      ) : null}

      {item.type === 'speak' ? <p className="m-0 text-body font-semibold">Read this aloud to your tutor.</p> : null}

      {showKey ? (
        <div lang="id" className="flex flex-col gap-1 rounded-control border-2 border-success bg-success-50 px-3.5 py-2.5">
          <span className="text-body font-bold">Jawaban: {showKey.answerText}</span>
          {showKey.explanation ? <span className="text-body">{showKey.explanation}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
