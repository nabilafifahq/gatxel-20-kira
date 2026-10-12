'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { LjkActions, LjkDTO } from '@/lib/dto'
import { Button, ButtonLink } from '@/components/console/Button'
import { ConsoleShell } from '@/components/console/ConsoleShell'
import { cx } from '@/components/console/cx'
import { ConfirmDialog } from '@/components/console/Dialog'
import { ActionError, EmptyState, InlineAlert } from '@/components/console/Feedback'
import { LjkGrid, skippedNumbers } from '@/components/console/LjkGrid'
import { PageHeader } from '@/components/console/Layout'
import { CONSOLE_ROUTES, PRINT_ROUTES } from '@/components/console/routes'
import { useToast } from '@/components/console/Toast'
import { useAction } from '@/components/console/useAction'

/**
 * T06 Input LJK (papan InputLjk, LjkGrid): tutor menyalin lembar jawaban kertas
 * dengan satu ketukan per nomor. Cepat di HP: baris 60px, bulatan 46px, bar simpan
 * menempel di bawah. Nomor yang terlewat disebut sebelum menyimpan.
 * Lembar dipilih lewat parameter URL `lembar`.
 */

export type LjkScreenProps = { data: LjkDTO; actions: LjkActions }

export function LjkScreen({ data, actions }: LjkScreenProps) {
  const toast = useToast()
  const sel = data.selected
  const [answers, setAnswers] = useState<(string | null)[]>(() => sel?.answers ?? [])
  const [src, setSrc] = useState(sel)
  const [score, setScore] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const save = useAction(actions.saveLjk)
  if (src !== sel) {
    setSrc(sel)
    setAnswers(sel?.answers ?? [])
    setScore(null)
  }

  const filled = answers.filter((a) => a != null && a !== '').length
  const skipped = skippedNumbers(answers)

  async function run(submit: boolean) {
    if (!sel) return
    const r = await save.run({ attemptId: sel.attemptId, answers, submit })
    if (r.ok) {
      if (submit) {
        setScore(r.data.score)
        toast({ tone: 'success', title: `Nilai ${sel.title} tersimpan: ${r.data.score}.` })
      } else {
        toast({ tone: 'success', title: `${filled} jawaban tersimpan sebagai draf.` })
      }
    } else {
      toast({ tone: 'error', title: r.message, body: 'Jawaban di layar ini tetap ada. Coba simpan lagi.', reference: r.reference })
    }
    setConfirmOpen(false)
  }

  return (
    <ConsoleShell shell={data.shell} active="ljk">
      <PageHeader
        title="Input LJK"
        description="Salin jawaban dari lembar kertas. Kunci tidak tampil di layar ini; nilai dihitung di server setelah disimpan."
        actions={
          <ButtonLink href={CONSOLE_ROUTES.inbox} variant="secondary" icon="inbox">
            Hasil dan penilaian
          </ButtonLink>
        }
      />

      {data.sheets.length === 0 ? (
        <EmptyState
          icon="ljk"
          title="Belum ada lembar kertas yang menunggu."
          body="Lembar muncul di sini setelah paper mode Kertas dimasukkan ke rencana dan LJK-nya dicetak."
          actions={
            <ButtonLink href={CONSOLE_ROUTES.paper} variant="primary">
              Buka penyusun paper
            </ButtonLink>
          }
        />
      ) : (
        <>
          <nav aria-label="Pilih lembar" className="flex flex-col gap-2">
            <h2 className="m-0 text-small font-bold text-fg-muted">Lembar yang menunggu</h2>
            <ul className="relative m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1">
              {data.sheets.map((s) => {
                const on = s.attemptId === sel?.attemptId
                return (
                  <li key={s.attemptId} className="flex-none">
                    <Link
                      href={`?lembar=${encodeURIComponent(s.attemptId)}`}
                      aria-current={on ? 'true' : undefined}
                      scroll={false}
                      className={cx(
                        'flex w-[260px] flex-col rounded-card bg-surface px-3.5 py-3 text-fg no-underline hover:text-fg',
                        on ? 'border-3 border-fg' : 'border border-divider hover:border-fg',
                      )}
                    >
                      <span className="truncate text-body font-bold">{s.title}</span>
                      <span className="text-small text-fg-muted tabular">
                        {s.learnerName}, {s.questionCount} soal, kode {s.code}
                      </span>
                      <span className={cx('text-small font-semibold tabular', s.entered === s.questionCount ? 'text-success' : 'text-fg')}>
                        {s.entered === 0 ? 'Belum diisi' : `${s.entered} dari ${s.questionCount} terisi`}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {sel ? (
            <section aria-labelledby="judul-lembar" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3 rounded-card border border-divider bg-surface px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <h2 id="judul-lembar" className="m-0 text-body font-bold">
                    {sel.title}, {sel.learnerName}
                  </h2>
                  <span className="text-small text-fg-muted tabular">
                    {sel.questionCount} soal, kode {sel.code}
                  </span>
                </div>
                <ButtonLink href={PRINT_ROUTES.ljk(sel.attemptId)} variant="secondary" size="S" icon="printer" target="_blank">
                  Cetak LJK
                </ButtonLink>
              </div>
              <p className="m-0 text-small text-fg-muted">
                Ketuk satu huruf per nomor, ketuk lagi untuk menghapus. Paket ini memakai A sampai {sel.optionCount === 5 ? 'E' : 'D'}
                {sel.shortAnswerFrom ? `, nomor ${sel.shortAnswerFrom} ke atas isian` : ''}. Di laptop, huruf di keyboard langsung mengisi nomor yang sedang fokus.
              </p>

              {score ? (
                <InlineAlert
                  tone="success"
                  title={`Nilai tersimpan: ${score}.`}
                  action={
                    <ButtonLink href={CONSOLE_ROUTES.inbox} variant="secondary" size="S">
                      Lihat di Hasil
                    </ButtonLink>
                  }
                >
                  Nilai masuk ke riwayat attempt dan peta penguasaan.
                </InlineAlert>
              ) : null}

              <LjkGrid
                answers={answers}
                optionCount={sel.optionCount}
                shortAnswerFrom={sel.shortAnswerFrom}
                onChange={(i, v) => {
                  setScore(null)
                  setAnswers((a) => a.map((x, j) => (j === i ? v : x)))
                }}
              />

              <div className="sticky bottom-0 z-20 -mx-4 flex items-center gap-2 border-t border-divider bg-surface px-4 py-2.5 max-lg:bottom-[72px] sm:-mx-6 sm:gap-3 sm:px-6 sm:py-3 lg:-mx-10 lg:px-10">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span role="status" className="text-body font-bold tabular">
                    {filled} dari {sel.questionCount} terisi
                  </span>
                  <span className={cx('text-small max-sm:truncate', skipped.length ? 'font-semibold text-warn' : 'text-fg-muted')}>
                    {skipped.length
                      ? `Kosong: nomor ${skipped.join(', ')}.`
                      : 'Tidak ada nomor yang terlewat.'}
                  </span>
                </div>
                <Button variant="secondary" onClick={() => run(false)} disabled={save.pending} className="max-sm:h-9 max-sm:px-2.5 max-sm:text-small">
                  Simpan draf
                </Button>
                <Button
                  variant="primary"
                  className="max-sm:h-9 max-sm:px-2.5 max-sm:text-small"
                  loading={save.pending}
                  onClick={() => {
                    if (skipped.length || filled < sel.questionCount) setConfirmOpen(true)
                    else void run(true)
                  }}
                >
                  Simpan dan nilai
                </Button>
              </div>
              <ActionError error={save.error} />
            </section>
          ) : (
            <p className="m-0 text-body text-fg-muted">Pilih lembar di atas untuk mulai mengisi.</p>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        tone="primary"
        title={`Nilai dengan ${(sel?.questionCount ?? 0) - filled} nomor kosong?`}
        body={
          skipped.length
            ? `Nomor ${skipped.join(', ')} kosong padahal nomor sesudahnya terisi. Nomor kosong dihitung salah.`
            : 'Nomor yang belum diisi dihitung salah. Pastikan lembar memang tidak dijawab di nomor itu.'
        }
        confirmLabel="Tetap nilai"
        cancelLabel="Periksa lagi"
        onConfirm={() => run(true)}
      />
    </ConsoleShell>
  )
}
