import type { PrintPaperDTO, Subject } from '@/lib/dto'
import { formatDateEn } from '@kira/core/time'
import { ItemStatic } from '@/components/print/ItemStatic'
import { estimateItemHeight, paginate, type Block } from '@/components/print/paginate'
import { PrintSheet, PrintStyles } from '@/components/print/PrintSheet'
import { PrintToolbar } from '@/components/print/PrintToolbar'

/**
 * C01 Paper A4 (papan PaperA4Hal1, PaperA4Hal2) dan kunci jawaban (PaperA4Kunci, bila withKey).
 * Komponen server: soal dibagi ke halaman A4 dengan perkiraan tinggi, header membawa kode
 * paper dan warna mapel, footer membawa kode dan nomor halaman. Kertas ditulis dalam en-GB.
 */

type Q = PrintPaperDTO['sections'][number]['items'][number]

const PILL_BG: Record<Subject, string> = { math: 'bg-math', english: 'bg-english', science: 'bg-science' }

// Tinggi dalam px pada 96 dpi untuk lembar 1123 px dikurangi padding 56 + 48.
const INNER = 1019
const HEADER = 46 + 20
const FOOTER = 31 + 20
const GAP = 20

function NumberPill({ n, subject }: { n: number; subject: Subject }) {
  return (
    <span
      className={`mt-px inline-flex h-7 min-w-9 flex-none items-center justify-center rounded-pill px-2.5 text-body font-bold text-white tabular ${PILL_BG[subject]}`}
    >
      {n}
    </span>
  )
}

function Question({ q, subject }: { q: Q; subject: Subject }) {
  return (
    <section aria-label={`Question ${q.number}`} className="print-avoid flex gap-3">
      <NumberPill n={q.number} subject={subject} />
      <div className="min-w-0 flex-1">
        <ItemStatic item={q.item} workBox={subject === 'math'} />
      </div>
    </section>
  )
}

function TitleBlock({ data }: { data: PrintPaperDTO }) {
  return (
    <>
      <div className="flex flex-none items-end gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="m-0 text-h1 font-bold text-balance">{data.withKey ? `${data.title}: answers` : data.title}</h1>
          <p className="m-0 text-body text-fg-muted">
            {data.withKey
              ? `${totalMarks(data)} marks in total. Keep this page away from the learner's copy.`
              : `Grade ${data.grade}. About ${data.minutes} minutes.`}
          </p>
        </div>
        {!data.withKey ? (
          <div className="flex flex-none flex-col items-end gap-2 text-body font-semibold">
            {data.learnerName ? (
              <span className="flex items-end gap-2">
                Name <span className="min-w-[150px] border-b border-fg pb-0.5 font-reading font-normal">{data.learnerName}</span>
              </span>
            ) : null}
            <span className="flex items-end gap-2">
              Date
              {data.date ? (
                <span className="min-w-[150px] border-b border-fg pb-0.5 font-normal">{formatDateEn(data.date)}</span>
              ) : (
                <span className="h-[22px] w-[150px] border-b border-fg" />
              )}
            </span>
          </div>
        ) : null}
      </div>
      {!data.withKey && data.instructions.length > 0 ? (
        <div className="flex-none rounded-control border border-fg-muted px-4 py-3 text-body">{data.instructions.join(' ')}</div>
      ) : null}
    </>
  )
}

function totalMarks(data: PrintPaperDTO): number {
  return data.sections.reduce((a, s) => a + s.items.reduce((b, q) => b + (q.item.points ?? 1), 0), 0)
}

function KeyTable({ rows }: { rows: Q[] }) {
  return (
    <table className="w-full flex-none border-collapse text-body">
      <thead>
        <tr>
          <th scope="col" className="w-12 border-b-2 border-fg px-2 py-2.5 text-right">
            No.
          </th>
          <th scope="col" className="w-[220px] border-b-2 border-fg px-3 py-2.5 text-left">
            Answer
          </th>
          <th scope="col" className="border-b-2 border-fg px-3 py-2.5 text-left">
            Also accept, and what to watch for
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((q) => (
          <tr key={q.number} className="print-avoid">
            <td className="border-b border-fg-muted px-2 py-3 text-right align-top font-bold tabular">{q.number}</td>
            <td lang={q.item.lang} className="border-b border-fg-muted px-3 py-3 align-top font-reading text-body-lg font-bold">
              {q.answerText ?? q.item.reveal?.answerText ?? 'See the solution in Kira'}
            </td>
            <td className="border-b border-fg-muted px-3 py-3 align-top">{q.explanation ?? q.item.reveal?.explanation ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function keyRowHeight(q: Q): number {
  const a = Math.ceil((q.answerText ?? '').length / 22) || 1
  const b = Math.ceil((q.explanation ?? '').length / 52) || 1
  return Math.max(a * 26, b * 24) + 26
}

export function PrintPaper({ data }: { data: PrintPaperDTO }) {
  const all = data.sections.flatMap((s) => s.items)
  const titleH = 38 + 4 + 24 + GAP
  const instrH = !data.withKey && data.instructions.length ? Math.ceil(data.instructions.join(' ').length / 80) * 24 + 26 + GAP : 0
  const capacity = INNER - HEADER - FOOTER

  if (data.withKey) {
    const blocks: Block<Q>[] = all.map((q) => ({ kind: 'item', data: q, height: keyRowHeight(q) }))
    const noteH = 110
    const pages = paginate(blocks, capacity - titleH - 46, capacity - 46, 0)
    // catatan "After marking" di halaman terakhir
    const lastUsed = pages[pages.length - 1]!.reduce((a, b) => a + b.height, 0)
    const needExtra = lastUsed + noteH > capacity - 46 - (pages.length === 1 ? titleH : 0)
    const total = pages.length + (needExtra ? 1 : 0)
    return (
      <div className="print-stack">
        <PrintStyles />
        <PrintToolbar note={`Kunci jawaban ${data.code}`} />
        {pages.map((p, i) => (
          <PrintSheet key={i} code={data.code} label="Answer key, for the tutor" accent={null} page={i + 1} pages={total} footerLabel={`${data.code}, answer key`}>
            {i === 0 ? <TitleBlock data={data} /> : null}
            <KeyTable rows={p.flatMap((b) => (b.kind === 'item' ? [b.data] : []))} />
            {i === pages.length - 1 && !needExtra ? <AfterMarking /> : null}
          </PrintSheet>
        ))}
        {needExtra ? (
          <PrintSheet code={data.code} label="Answer key, for the tutor" accent={null} page={total} pages={total} footerLabel={`${data.code}, answer key`}>
            <AfterMarking />
          </PrintSheet>
        ) : null}
      </div>
    )
  }

  const blocks: Block<Q>[] = []
  for (const s of data.sections) {
    if (s.title) blocks.push({ kind: 'section', title: s.title, height: 34 })
    for (const q of s.items) blocks.push({ kind: 'item', data: q, height: estimateItemHeight(q.item, data.subject === 'math') })
  }
  const pages = paginate(blocks, capacity - titleH - instrH, capacity, GAP)

  return (
    <div className="print-stack">
      <PrintStyles />
      <PrintToolbar note={`Paper ${data.code}, ${pages.length} halaman`} />
      {pages.map((p, i) => (
        <PrintSheet
          key={i}
          code={data.code}
          label={`${data.subjectLabel}, Grade ${data.grade}`}
          accent={data.subject}
          page={i + 1}
          pages={pages.length}
          footerLabel={`${data.code}, ${data.title}`}
        >
          {i === 0 ? <TitleBlock data={data} /> : null}
          {p.map((b, j) =>
            b.kind === 'section' ? (
              <h2 key={`s-${j}`} className="m-0 mt-1.5 flex-none text-h3 font-bold">
                {b.title}
              </h2>
            ) : (
              <Question key={b.data.number} q={b.data} subject={data.subject} />
            ),
          )}
        </PrintSheet>
      ))}
    </div>
  )
}

function AfterMarking() {
  return (
    <div className="print-avoid flex flex-none flex-col gap-2 rounded-control border border-fg-muted px-4 py-3.5">
      <span className="text-body font-bold">After marking</span>
      <span className="text-body">Enter the score in Kira under Hasil, or copy the answer sheet in Input LJK. The marks update the skills in this paper.</span>
    </div>
  )
}
