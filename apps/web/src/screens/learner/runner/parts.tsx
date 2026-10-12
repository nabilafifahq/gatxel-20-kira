'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, type ReactElement } from 'react'
import type { RunnerActions } from '@/lib/dto'
import { Button, IconButton } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { Dialog } from '@/components/ui/Dialog'
import { useToast } from '@/components/ui/Toast'

/** Tombol keluar dengan dialog konfirmasi. Jawaban sudah tersimpan, jadi keluar selalu aman. */
export function ExitControl({
  exitHref,
  beforeLeave,
  title = 'Leave this quest?',
  body = 'Your answers are saved. You can carry on later.',
  stayLabel = 'Keep going',
  leaveLabel = 'Leave',
  ariaLabel = 'Exit quest',
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
  return (
    <>
      <IconButton icon="close" label={ariaLabel} onClick={() => setOpen(true)} className={cx('max-md:h-12 max-md:w-12', className)} />
      <Dialog
        open={open}
        onClose={() => !leaving && setOpen(false)}
        title={title}
        description={body}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={leaving} data-autofocus>
              {stayLabel}
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
              {leaveLabel}
            </Button>
          </>
        }
      />
    </>
  )
}

const REASONS: { id: 'wrong-answer' | 'confusing' | 'picture' | 'other'; label: string }[] = [
  { id: 'wrong-answer', label: 'The answer looks wrong' },
  { id: 'confusing', label: 'The question is confusing' },
  { id: 'picture', label: 'The picture has a problem' },
  { id: 'other', label: 'Something else' },
]

/** Tombol bendera kecil untuk melaporkan masalah soal ke tutor. */
export function ReportControl({ itemRef, reportProblem, className }: { itemRef: string; reportProblem: RunnerActions['reportProblem']; className?: string }): ReactElement {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<(typeof REASONS)[number]['id']>('wrong-answer')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; reference: string } | null>(null)
  const toast = useToast()
  const noteId = useId()
  const close = () => {
    if (busy) return
    setOpen(false)
    setError(null)
  }
  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await reportProblem({ itemRef, reason, note: note.trim().slice(0, 300) })
      if (res.ok) {
        setOpen(false)
        setNote('')
        toast({ kind: 'success', title: 'Thank you. Your tutor will look at this question.', reference: res.data.reference })
      } else {
        setError({ message: res.message, reference: res.reference })
      }
    } catch {
      setError({ message: 'The report did not send. Check the internet and try again.', reference: 'KRA-RPT-NET' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <IconButton icon="report" label="Report a problem with this question" size="M" variant="quiet" onClick={() => setOpen(true)} className={className} />
      <Dialog
        open={open}
        onClose={close}
        title="Something wrong here?"
        description="Tell your tutor what is wrong with this question."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void send()} icon="send">
              Send to tutor
            </Button>
          </>
        }
      >
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-body-lg font-bold">What is the problem?</legend>
          {REASONS.map((r) => (
            <label
              key={r.id}
              className={cx(
                'flex min-h-14 cursor-pointer items-center gap-3 rounded-control px-4',
                reason === r.id ? 'border-3 border-fg bg-bg' : 'border-2 border-border bg-surface',
              )}
            >
              <input type="radio" name="report-reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="h-6 w-6 flex-none accent-fg" />
              <span className="text-body-lg font-semibold">{r.label}</span>
            </label>
          ))}
        </fieldset>
        <label htmlFor={noteId} className="text-body-lg font-bold">
          Anything else? <span className="font-normal text-fg-muted">(you can leave this empty)</span>
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
            {error.message} <span className="tabular-nums text-fg-muted">Reference {error.reference}</span>
          </p>
        ) : null}
      </Dialog>
    </>
  )
}
