'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, type ReactElement } from 'react'
import type { RunnerActions } from '@/lib/dto'
import { Button, IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n/client'

/** Tombol keluar dengan dialog konfirmasi. Jawaban sudah tersimpan, jadi keluar selalu aman. */
export function ExitControl({
  exitHref,
  beforeLeave,
  title,
  body,
  stayLabel,
  leaveLabel,
  ariaLabel,
  className,
}: {
  exitHref: string
  beforeLeave?: () => Promise<unknown>
  title?: string
  body?: string
  stayLabel?: string
  leaveLabel?: string
  ariaLabel?: string
  className?: string
}): ReactElement {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const t = useT().runner.exit
  return (
    <>
      <IconButton icon="close" label={ariaLabel ?? t.aria} onClick={() => setOpen(true)} className={cx('max-md:h-12 max-md:w-12', className)} />
      <Dialog
        open={open}
        onClose={() => !leaving && setOpen(false)}
        title={title ?? t.title}
        description={body ?? t.body}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={leaving} data-autofocus>
              {stayLabel ?? t.stay}
            </Button>
            <Button
              loading={leaving}
              onClick={async () => {
                setLeaving(true)
                try {
                  await beforeLeave?.()
                } finally {
                  router.push(exitHref)
                }
              }}
            >
              {leaveLabel ?? t.leave}
            </Button>
          </>
        }
      />
    </>
  )
}

const REASONS = ['wrong-answer', 'confusing', 'picture', 'other'] as const

/** Tombol bendera kecil untuk melaporkan masalah soal ke tutor. */
export function ReportControl({ itemRef, reportProblem, screen, className }: { itemRef: string; reportProblem: RunnerActions['reportProblem']; screen: 'practice' | 'test'; className?: string }): ReactElement {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<(typeof REASONS)[number]>('wrong-answer')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)
  const toast = useToast()
  const noteId = useId()
  const dict = useT()
  const t = dict.runner.report
  const close = () => {
    if (busy) return
    setOpen(false)
    setError(null)
  }
  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await reportProblem({ itemRef, reason, note: note.trim().slice(0, 300), screen })
      if (res.ok) {
        setOpen(false)
        setNote('')
        toast({ kind: 'success', title: t.thanks })
      } else {
        setError({ message: res.message, reference: res.reference })
      }
    } catch {
      setError({ message: t.failed, reference: 'KRA-RPT-NET' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <IconButton icon="report" label={t.aria} size="M" variant="quiet" onClick={() => setOpen(true)} className={className} />
      <Dialog
        open={open}
        onClose={close}
        title={t.title}
        description={t.description}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              {dict.common.cancel}
            </Button>
            <Button loading={busy} onClick={() => void send()} icon="send">
              {t.send}
            </Button>
          </>
        }
      >
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-body-lg font-bold">{t.legend}</legend>
          {REASONS.map((r) => (
            <label
              key={r}
              className={cx(
                'flex min-h-14 cursor-pointer items-center gap-3 rounded-control px-4',
                reason === r ? 'border-3 border-fg bg-bg' : 'border-2 border-border bg-surface',
              )}
            >
              <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="h-6 w-6 flex-none accent-fg" />
              <span className="text-body-lg font-semibold">{t.reasons[r]}</span>
            </label>
          ))}
        </fieldset>
        <label htmlFor={noteId} className="text-body-lg font-bold">
          {t.note} <span className="font-normal text-fg-muted">{t.noteOptional}</span>
        </label>
        <textarea
          id={noteId}
          value={note}
          maxLength={300}
          rows={3}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-control border-2 border-border bg-surface px-4 py-3 text-body-lg"
        />
        {error ? (
          <p role="alert" className="m-0 rounded-control border-2 border-danger bg-danger-50 px-4 py-3 text-body">
            {error.message} <span className="tabular-nums text-fg-muted">{dict.runner.reference(error.reference)}</span>
          </p>
        ) : null}
      </Dialog>
    </>
  )
}
