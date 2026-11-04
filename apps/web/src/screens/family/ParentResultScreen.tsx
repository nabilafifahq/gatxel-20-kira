import Link from 'next/link'
import type { ParentResultDTO, ParentResultRow } from '@/lib/dto-parent'
import { cx } from '@/components/console/cx'
import { FAMILY_ROUTES } from '@/components/console/routes'

/**
 * Hasil satu sesi untuk orang tua: tiap soal dengan jawaban anak, jawaban benar, dan penjelasan.
 * Soal yang dilihat orang dewasa (tulis, bicara, gambar, foto) ditandai tanpa menunggu penilaian.
 */

const STATUS: Record<ParentResultRow['status'], { label: string; cls: string }> = {
  correct: { label: 'Benar', cls: 'bg-success-50 text-success' },
  wrong: { label: 'Belum tepat', cls: 'bg-warn-50 text-fg' },
  blank: { label: 'Tidak dijawab', cls: 'bg-bg text-fg-muted' },
  pending: { label: 'Menunggu dilihat', cls: 'bg-bg text-fg-muted' },
}

export function ParentResultScreen({ data }: { data: ParentResultDTO }) {
  const right = data.rows.filter((r) => r.status === 'correct').length
  return (
    <>
      <Link href={`${FAMILY_ROUTES.child(data.learner.id)}`} className="inline-flex h-11 items-center self-start text-body font-bold">
        ‹ Kembali ke {data.learner.name}
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-h2 font-bold">{data.attempt.title}</h1>
        <p className="m-0 text-body text-fg-muted">
          {data.learner.name}, skor {data.attempt.score}. {right} dari {data.rows.length} soal benar.
        </p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {data.rows.map((r) => (
          <li key={r.position} className="flex flex-col gap-2 rounded-card border border-divider bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body font-bold">Soal {r.position}</span>
              <span className={cx('inline-flex h-7 items-center rounded-pill px-3 text-small font-bold', STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
              <span className="text-small text-fg-muted">{r.skillTitle}</span>
            </div>
            <p className="m-0 font-reading text-body">{r.prompt}</p>
            <dl className="m-0 flex flex-col gap-1.5">
              <div>
                <dt className="text-small font-bold text-fg-muted">Jawaban anak</dt>
                <dd className="m-0 text-body">{r.yourAnswer}</dd>
              </div>
              <div>
                <dt className="text-small font-bold text-fg-muted">Jawaban benar</dt>
                <dd className="m-0 text-body">{r.correctAnswer}</dd>
              </div>
              {r.explanation ? (
                <div>
                  <dt className="text-small font-bold text-fg-muted">Penjelasan</dt>
                  <dd className="m-0 font-reading text-body">{r.explanation}</dd>
                </div>
              ) : null}
            </dl>
          </li>
        ))}
      </ol>
    </>
  )
}
