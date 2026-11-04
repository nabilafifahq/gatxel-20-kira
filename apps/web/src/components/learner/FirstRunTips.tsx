'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { UiIcon, type UiIconName } from '@/components/ui/icons'
import { useT } from '@/lib/i18n/client'
import { KiraStar } from '@/components/ui/KiraStar'
import { markFirstRunAction } from '@/server/actions/first-run'

const TIPS: { key: 'start' | 'stars' | 'listen'; icon: UiIconName }[] = [
  { key: 'start', icon: 'play' },
  { key: 'stars', icon: 'star' },
  { key: 'listen', icon: 'speaker' },
]

/**
 * Walkthrough pertama anak di Today: kartu kecil, bukan dialog, jadi halaman di belakangnya tetap bisa diketuk.
 * Dicatat di server begitu tampil, supaya hanya muncul sekali per anak, di perangkat mana pun.
 */
export function FirstRunTips(): ReactElement | null {
  const T = useT().shell.firstRun
  const [i, setI] = useState(0)
  const [open, setOpen] = useState(true)
  const marked = useRef(false)
  useEffect(() => {
    if (marked.current) return
    marked.current = true
    void markFirstRunAction().catch(() => undefined)
  }, [])
  if (!open) return null
  const total = TIPS.length
  const tipDef = TIPS[i]!
  const tip = T[tipDef.key]
  const last = i === total - 1
  return (
    <aside
      aria-label={T.region}
      data-testid="first-run-tips"
      className="kira-fade-up fixed inset-x-3 bottom-[calc(84px+var(--safe-bottom))] z-40 flex flex-col gap-3 rounded-card border-2 border-fg bg-surface p-4 shadow-soft md:inset-x-auto md:right-6 md:bottom-6 md:w-[380px]"
    >
      <div className="flex items-start gap-3">
        <KiraStar size={48} animate={false} />
        <div className="flex min-w-0 flex-1 flex-col" aria-live="polite">
          <span className="text-small font-bold">{T.stepOf(i + 1, total)}</span>
          <h2 className="m-0 flex items-center gap-2 text-h3 font-bold">
            <UiIcon name={tipDef.icon} size={20} />
            {tip.title}
          </h2>
          <p className="m-0 text-body">{tip.body}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 cursor-pointer border-0 bg-transparent px-1 text-body font-bold text-fg underline underline-offset-3">
          {T.skip}
        </button>
        <button
          type="button"
          onClick={() => (last ? setOpen(false) : setI(i + 1))}
          className="min-h-12 cursor-pointer rounded-control border-2 border-fg bg-fg px-5 text-body font-extrabold text-white"
        >
          {last ? T.done : T.next}
        </button>
      </div>
    </aside>
  )
}
