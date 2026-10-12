'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Figure } from '@kira/figures'
import type { GradingDTO, InboxActions, InboxDTO, InboxRow } from '@/lib/dto'
import { AudioPlayer } from '@/components/console/AudioPlayer'
import { Button, ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ActionError, EmptyState, InlineAlert } from '@/components/console/Feedback'
import { TextArea } from '@/components/console/Field'
import { dateTimeId, SUBJECT_LABEL } from '@/components/console/format'
import { ConsoleIcon } from '@/components/console/icons'
import { Pill, SubjectChip } from '@/components/console/Layout'
import { CONSOLE_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'

/**
 * T05 Hasil dan penilaian (papan KotakHasil, KotakHasilHP, KotakHasilSelesai,
 * KotakHasilFase3, KotakHasilSaranAi). Daftar jawaban yang dinilai tutor (tulisan,
 * foto kertas, rekaman, gambar), penilaian per kriteria rubrik, dan saran nilai AI
 * yang hanya mengisi rubrik setelah tutor memilih untuk memakainya.
 * Tab dan pilihan jawaban memakai parameter URL `filter` dan `respon`.
 */

export type InboxScreenProps = { data: InboxDTO; actions: InboxActions }

const TYPE_LINE: Record<InboxRow['type'], string> = {
  write: 'jawaban diketik',
  photo: 'foto kertas',
  speak: 'rekaman suara',
  draw: 'gambar di tablet',
}

function answerLabel(row: InboxRow | undefined, name: string): string {
  switch (row?.type) {
    case 'photo':
      return `Jawaban ${name}, ditulis di kertas lalu difoto`
    case 'speak':
      return `Jawaban ${name}, direkam di tablet`
    case 'draw':
      return `Jawaban ${name}, digambar di tablet`
    default:
      return `Jawaban ${name}, diketik di tablet`
  }
}

function href(filter: InboxDTO['filter'], respon?: string): string {
  const p = new URLSearchParams({ filter })
  if (respon) p.set('respon', respon)
  return `?${p.toString()}`
}

function RowList({ rows, filter, selectedId }: { rows: InboxRow[]; filter: InboxDTO['filter']; selectedId: string | null }) {
  return (
    <ul aria-label={filter === 'waiting' ? 'Jawaban menunggu nilai' : 'Jawaban yang sudah dinilai'} className="m-0 flex list-none flex-col gap-2 p-0">
      {rows.map((r) => {
        const on = r.responseId === selectedId
        return (
          <li key={r.responseId} className="flex">
            <Link
              href={href(filter, r.responseId)}
              aria-current={on ? 'true' : undefined}
              scroll={false}
              className={cx(
                'flex flex-1 flex-col gap-1 rounded-card bg-surface px-4 py-3.5 text-fg no-underline hover:text-fg',
                on ? 'border-3 border-fg' : 'border border-divider hover:border-fg',
              )}
            >
              <span className="flex flex-wrap items-center gap-2">
                <SubjectChip subject={r.subject} withIcon={false} size="sm" />
                <span className="text-small text-fg-muted">{dateTimeId(r.submittedAt)}</span>
                {r.status === 'graded' && r.score != null ? (
                  <span className="ml-auto text-body font-bold tabular">
                    {r.score} dari {r.max}
                  </span>
                ) : null}
              </span>
              <span className="text-body font-bold">{r.itemTitle}</span>
              <span className="text-small text-fg-muted">
                {r.learnerName}, {TYPE_LINE[r.type]}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Grader({
  g,
  row,
  aiEnabled,
  actions,
  nextHref,
  filter,
}: {
  g: GradingDTO
  row: InboxRow | undefined
  aiEnabled: boolean
  actions: InboxActions
  nextHref: string | null
  filter: InboxDTO['filter']
}) {
  const toast = useToast()
  const router = useRouter()
  const [scores, setScores] = useState<(number | null)[]>(() => g.rubric.map((_, i) => g.scores?.[i] ?? null))
  const [feedback, setFeedback] = useState(g.feedback ?? '')
  const [aiApplied, setAiApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiRequested, setAiRequested] = useState(false)
  const save = useAction(actions.grade)
  const askAi = useAction(actions.requestAiSuggestion)

  const max = g.rubric.reduce((a, c) => a + c.points, 0)
  const complete = scores.every((s) => s != null)
  const total = scores.reduce<number>((a, s) => a + (s ?? 0), 0)
  const ai = g.aiSuggestion
  const acceptedAi = Boolean(ai && aiApplied && ai.scores.every((s, i) => s === scores[i]))
  const canAskAi = aiEnabled && !ai && (row?.type === 'write' || row?.type === 'photo')

  async function submit() {
    if (!complete) {
      setError(`Pilih nilai untuk ${g.rubric.length === 2 ? 'kedua' : 'semua'} kriteria dulu.`)
      return
    }
    setError(null)
    const r = await save.run({ responseId: g.responseId, scores: scores as number[], feedback: feedback.trim(), acceptedAi })
    if (r.ok) {
      toast({ tone: 'success', title: `Nilai ${row?.itemTitle ?? 'jawaban'} tersimpan: ${total} dari ${max}.` })
      if (nextHref) router.push(nextHref, { scroll: false })
    }
  }

  async function requestAi() {
    const r = await askAi.run(g.responseId)
    if (r.ok) setAiRequested(true)
  }

  return (
    <section aria-labelledby="judul-nilai" className="flex min-w-0 flex-[2_1_560px] flex-col gap-[18px] rounded-card border border-divider bg-surface p-6 max-sm:p-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 id="judul-nilai" className="m-0 text-h2 font-bold max-sm:text-h3">
            {row?.itemTitle ?? 'Jawaban'}
          </h2>
          {row?.status === 'graded' && row.score != null ? (
            <Pill tone="success">
              <ConsoleIcon name="check" size={14} strokeWidth={3} />
              Sudah dinilai, {row.score} dari {row.max}
            </Pill>
          ) : null}
        </div>
        <span className="text-body text-fg-muted">
          {g.learnerName}
          {row ? `, ${SUBJECT_LABEL[row.subject]}, dikirim ${dateTimeId(row.submittedAt)}` : ''}. Rubrik {max} poin.
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-small font-bold text-fg-muted">Soal</span>
        <p lang={g.item.lang} className="m-0 font-reading text-h3 leading-[30px]">
          {g.prompt}
        </p>
        {g.item.figure ? <Figure spec={g.item.figure} maxWidth={360} /> : null}
        {g.item.readText ? (
          <p lang={g.item.lang} className="m-0 rounded-control bg-bg px-3 py-2 font-reading text-body-lg">
            {g.item.readText}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-small font-bold text-fg-muted">{answerLabel(row, g.learnerName)}</span>
        {g.mediaKind === 'audio' && g.mediaUrl ? (
          <>
            <AudioPlayer src={g.mediaUrl} label={`Putar rekaman ${g.learnerName}`} />
            <span className="text-small text-fg-muted">Rekaman tidak dikirim ke AI dan terhapus otomatis 90 hari setelah direkam.</span>
          </>
        ) : null}
        {g.mediaKind === 'image' && g.mediaUrl ? (
          <figure className="m-0 flex flex-col gap-1.5">
            <img
              src={g.mediaUrl}
              alt={g.answerText ? `${answerLabel(row, g.learnerName)}: ${g.answerText}` : answerLabel(row, g.learnerName)}
              className="max-h-[420px] w-full rounded-control border border-divider bg-white object-contain"
            />
            <figcaption className="text-small text-fg-muted">
              {row?.type === 'photo'
                ? 'Foto diunggah dari HP tutor. Saat dikirim untuk saran nilai, foto dikirim tanpa nama dan tanpa data EXIF.'
                : 'Gambar tersimpan sebagai jawaban dan tidak dikirim ke AI.'}
            </figcaption>
          </figure>
        ) : null}
        {g.mediaKind == null || (g.mediaKind === 'image' && !g.mediaUrl) ? (
          g.answerText ? (
            <p lang={g.item.lang} className="m-0 rounded-control border border-divider bg-bg px-4 py-3.5 font-reading text-h2 leading-[34px] whitespace-pre-line">
              {g.answerText}
            </p>
          ) : (
            <p className="m-0 rounded-control border border-dashed border-border bg-bg px-4 py-3.5 text-body text-fg-muted">Jawaban kosong.</p>
          )
        ) : null}
        {g.mediaKind && !g.mediaUrl ? (
          <InlineAlert tone="warn" title="Berkas jawaban belum sampai di server." live="none">
            Tablet mungkin belum sinkron. Coba lagi setelah tablet tersambung ke internet.
          </InlineAlert>
        ) : null}
      </div>

      {ai ? (
        <div className="flex flex-col gap-2.5 rounded-control border-2 border-math bg-math-50 px-[18px] py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-body font-bold">
              Saran nilai dari Claude: {ai.scores.reduce((a, b) => a + b, 0)} dari {max}
            </span>
            <span className="text-small text-fg-muted">
              {aiApplied ? 'Sudah mengisi rubrik, belum tersimpan' : 'Belum tersimpan sebagai nilai'}. Keyakinan {ai.confidence}.
            </span>
          </div>
          <ul className="m-0 flex flex-col gap-1 pl-5 text-body">
            {g.rubric.map((c, i) => (
              <li key={c.label}>
                {c.label}: {ai.scores[i] ?? 0} dari {c.points}
              </li>
            ))}
          </ul>
          {ai.feedback ? (
            <p lang="en-GB" className="m-0 text-body">
              Usulan pesan: {ai.feedback}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="border-math"
              onClick={() => {
                setScores(g.rubric.map((_, i) => ai.scores[i] ?? 0))
                if (!feedback.trim()) setFeedback(ai.feedback)
                setAiApplied(true)
                setError(null)
              }}
            >
              {aiApplied ? 'Isi ulang dengan saran ini' : 'Isi rubrik dengan saran ini'}
            </Button>
          </div>
          <span className="text-small text-fg-muted">Saran hanya mengisi rubrik. Nilai baru tersimpan setelah Simpan nilai, dan setiap kriteria tetap bisa diubah.</span>
        </div>
      ) : canAskAi ? (
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-divider bg-bg px-4 py-3">
          <ConsoleIcon name="sparkle" size={20} />
          <span className="min-w-0 flex-[1_1_240px] text-body">
            {aiRequested ? 'Saran sedang dibuat. Muat ulang halaman ini dalam satu atau dua menit.' : 'Minta saran nilai dari Claude. Jawaban dikirim tanpa nama learner.'}
          </span>
          {!aiRequested ? (
            <Button variant="secondary" size="S" onClick={requestAi} loading={askAi.pending}>
              Minta saran nilai
            </Button>
          ) : null}
          <ActionError error={askAi.error} className="w-full" />
        </div>
      ) : null}

      <div className="flex flex-col gap-3.5">
        {g.rubric.map((c, ci) => (
          <fieldset key={c.label} className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-body font-bold">
              {c.label}, {c.points} poin
            </legend>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: c.points + 1 }, (_, v) => {
                const on = scores[ci] === v
                return (
                  <label
                    key={v}
                    className={cx(
                      'flex min-h-11 min-w-[110px] flex-[1_1_110px] cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5',
                      on ? 'border-3 border-fg bg-bg' : 'border-2 border-border bg-surface hover:border-fg',
                    )}
                  >
                    <input
                      type="radio"
                      name={`nilai-${g.responseId}-${ci}`}
                      value={v}
                      checked={on}
                      onChange={() => {
                        setScores((s) => s.map((x, i) => (i === ci ? v : x)))
                        setError(null)
                      }}
                      className="size-5 flex-none cursor-pointer accent-fg"
                    />
                    <span className="text-body font-bold tabular">{v} poin</span>
                    {ai && ai.scores[ci] === v ? <span className="ml-auto text-small font-semibold text-math">saran AI</span> : null}
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <TextArea
        label={`Pesan untuk ${g.learnerName}, dalam English, boleh kosong`}
        lang="en-GB"
        rows={2}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        maxLength={500}
        placeholder="Contoh: Great sentence! Yesterday means it already happened, so play becomes played."
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-divider pt-3 max-lg:sticky max-lg:bottom-[72px] max-lg:z-20 max-lg:-mx-4 max-lg:bg-surface max-lg:px-4 max-lg:pb-3">
        <span className="text-body-lg font-bold tabular" aria-live="polite">
          {complete ? `Nilai: ${total} dari ${max}` : 'Nilai: belum lengkap'}
        </span>
        {error ? (
          <span role="alert" className="text-body font-bold text-danger">
            {error}
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-3">
          {nextHref ? (
            <ButtonLink href={nextHref} variant="secondary" scroll={false}>
              Lewati dulu
            </ButtonLink>
          ) : null}
          <Button variant="primary" onClick={submit} loading={save.pending}>
            {filter === 'graded' ? 'Simpan perubahan' : 'Simpan nilai'}
          </Button>
        </div>
      </div>
      <ActionError error={save.error} />
      <p className="m-0 text-small text-fg-muted">Setelah disimpan, nilai masuk ke akurasi skill ini dan pesan muncul di pembahasan learner.</p>
    </section>
  )
}

export function InboxScreen({ data, actions }: InboxScreenProps) {
  const waitingCount = data.rows.filter((r) => r.status === 'waiting').length
  const rows = data.rows.filter((r) => (data.filter === 'waiting' ? r.status === 'waiting' : r.status === 'graded'))
  const selId = data.selected?.responseId ?? null
  const idx = rows.findIndex((r) => r.responseId === selId)
  const next = rows.find((r, i) => i > idx && r.responseId !== selId) ?? rows.find((r) => r.responseId !== selId)
  const selRow = data.rows.find((r) => r.responseId === selId)

  return (
    <ConsoleShell shell={data.shell} active="inbox">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
          <h1 className="m-0 text-h1 font-bold max-sm:text-h2">Hasil dan penilaian</h1>
          <p className="m-0 text-body text-fg-muted">
            Pilihan ganda, isian angka, urutkan, dan jodohkan dinilai otomatis. Yang menunggu di sini jawaban tulisan, kertas, rekaman suara, dan gambar.
          </p>
        </div>
        <ButtonLink href={CONSOLE_ROUTES.ljk} variant="secondary" icon="ljk">
          Input LJK kertas
        </ButtonLink>
      </header>

      <nav aria-label="Status penilaian" className="-mb-2 flex gap-1 border-b-2 border-divider">
        {(['waiting', 'graded'] as const).map((f) => {
          const on = data.filter === f
          return (
            <Link
              key={f}
              href={href(f)}
              aria-current={on ? 'page' : undefined}
              scroll={false}
              className={cx(
                '-mb-0.5 inline-flex h-12 items-center border-0 border-b-3 px-[18px] text-body text-fg no-underline hover:text-fg',
                on ? 'border-fg font-extrabold' : 'border-transparent font-semibold hover:border-divider',
              )}
            >
              {f === 'waiting' ? `Menunggu nilai (${waitingCount})` : 'Sudah dinilai'}
            </Link>
          )
        })}
      </nav>

      {rows.length === 0 ? (
        data.filter === 'waiting' ? (
          <EmptyState
            icon="checkCircle"
            title="Tidak ada jawaban yang menunggu nilai."
            body="Pesan untuk learner muncul di pembahasan quest itu saat dibuka lagi."
            actions={
              <ButtonLink href={href('graded')} variant="secondary">
                Lihat yang sudah dinilai
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState icon="inbox" title="Belum ada jawaban yang dinilai." body="Jawaban tulisan, kertas, rekaman, dan gambar yang sudah dinilai muncul di sini." />
        )
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
            <details open={!data.selected} className="group lg:hidden">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-body font-bold [&::-webkit-details-marker]:hidden">
                <ConsoleIcon name="chevronDown" size={18} strokeWidth={2.5} className="transition-transform duration-150 ease-kira group-open:rotate-180" />
                Daftar jawaban ({rows.length})
              </summary>
              <div className="pt-2">
                <RowList rows={rows} filter={data.filter} selectedId={selId} />
              </div>
            </details>
            <div className="max-lg:hidden">
              <RowList rows={rows} filter={data.filter} selectedId={selId} />
            </div>
          </div>
          {data.selected ? (
            <Grader
              key={data.selected.responseId}
              g={data.selected}
              row={selRow}
              aiEnabled={data.shell.aiEnabled}
              actions={actions}
              nextHref={next ? href(data.filter, next.responseId) : null}
              filter={data.filter}
            />
          ) : (
            <section className="flex min-w-0 flex-[2_1_560px] flex-col items-center gap-2 rounded-card border border-divider bg-surface p-8 text-center">
              <p className="m-0 text-body-lg font-bold">Pilih jawaban di daftar untuk mulai menilai.</p>
            </section>
          )}
        </div>
      )}
    </ConsoleShell>
  )
}
