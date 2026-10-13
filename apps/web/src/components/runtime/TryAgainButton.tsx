'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import { Button } from '@/components/ui/Button'
import { retrySessionAction } from '@/server/actions/learner'

/**
 * Tombol "Try again" di halaman hasil: memulai percobaan ulang seluruh sesi lalu membuka runner.
 * Percobaan pertama tetap yang resmi; ulangan memberi seperempat XP.
 */
export function TryAgainButton({ attemptId, label }: { attemptId: string; label: string }): ReactElement {
  const router = useRouter()
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false })
  async function go() {
    setState({ busy: true })
    try {
      const r = await retrySessionAction(attemptId)
      if (r.ok) {
        router.push(r.data.redirectTo)
        return
      }
      setState({ busy: false, error: `${r.message} Reference ${r.reference}.` })
    } catch {
      setState({ busy: false, error: 'Could not start another try. Check the internet and try once more.' })
    }
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="secondary" icon="replay" loading={state.busy} onClick={go}>
        {label}
      </Button>
      {state.error ? (
        <p role="alert" className="m-0 text-body text-fg">
          {state.error}
        </p>
      ) : null}
    </div>
  )
}
