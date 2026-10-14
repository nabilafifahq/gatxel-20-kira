'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import { Avatar, Icon, type IconName } from '@kira/figures'
import type { ActionResult, AvatarName } from '@/lib/dto'
import type { ChestDTO, ChestRewardDTO } from '@/lib/dto-motion'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { playSfx, primeSfx } from './sfx'

/**
 * Peti hadiah harian di Today. Terkunci sampai semua sesi wajib selesai, lalu bergoyang pelan dan bisa
 * diketuk. Saat dibuka: tutup terangkat, cahaya memudar masuk, bunyi chest, lalu kartu hadiah berputar
 * masuk. Hadiah dipilih dan dicek di server (satu peti per hari). Teks memakai "earned", tidak pernah
 * "unlock". Gerak hanya transform dan opacity; reduced motion menampilkan hadiah langsung.
 */

export type ChestActions = {
  open(): Promise<ActionResult<ChestRewardDTO>>
  equip(input: { kind: 'accessory' | 'background'; id: string | null }): Promise<ActionResult>
}

const KIND_WORD: Record<ChestRewardDTO['kind'], string> = { sticker: 'sticker', background: 'avatar background', accessory: 'accessory' }

export function ChestArt({ open, locked, className }: { open: boolean; locked?: boolean; className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 96 80" width="144" height="120" aria-hidden="true" className={cx(className, locked && 'opacity-60')}>
      {open ? <circle cx="48" cy="30" r="26" className="kira-fade-in fill-star" fillOpacity="0.45" /> : null}
      <rect x="14" y="38" width="68" height="34" rx="5" className="fill-warn stroke-fg" strokeWidth="3" />
      <path d="M14 50h68" className="stroke-fg" strokeWidth="3" />
      <g className={open ? 'kira-chest-lid' : undefined}>
        <path d="M14 38c0-14 10-22 34-22s34 8 34 22z" className="fill-warn-50 stroke-fg" strokeWidth="3" strokeLinejoin="round" />
        <path d="M14 38h68" className="stroke-fg" strokeWidth="3" />
      </g>
      <rect x="40" y="44" width="16" height="14" rx="3" className="fill-star stroke-fg" strokeWidth="3" />
      <circle cx="48" cy="51" r="2" className="fill-fg" />
    </svg>
  )
}

function RewardArt({ reward, avatar, accessory, background }: { reward: ChestRewardDTO; avatar: AvatarName; accessory?: string | null; background?: string | null }): ReactElement {
  if (reward.kind === 'sticker') return <Icon name={reward.id as IconName} size={96} title={reward.label} />
  if (reward.kind === 'accessory') return <Avatar name={avatar} accessory={reward.id} background={background ?? null} size={96} title={reward.label} />
  return <Avatar name={avatar} accessory={accessory ?? null} background={reward.id} size={96} title={reward.label} />
}

export function DailyChest({
  chest,
  avatar,
  accessory,
  background,
  actions,
  className,
}: {
  chest: ChestDTO
  avatar: AvatarName
  accessory?: string | null
  background?: string | null
  actions?: ChestActions
  className?: string
}): ReactElement {
  const router = useRouter()
  const [stage, setStage] = useState<'idle' | 'busy' | 'revealed'>('idle')
  const [reward, setReward] = useState<ChestRewardDTO | null>(chest.reward)
  const [error, setError] = useState<string | null>(null)
  const [worn, setWorn] = useState(chest.equipped)
  const [wearBusy, setWearBusy] = useState(false)

  const shown = reward ?? chest.reward
  const state = shown && stage !== 'busy' ? 'opened' : chest.state

  async function open() {
    if (!actions || stage === 'busy') return
    primeSfx()
    setError(null)
    setStage('busy')
    try {
      const res = await actions.open()
      if (!res.ok) {
        setError(res.message)
        setStage('idle')
        return
      }
      playSfx('chest')
      setReward(res.data)
      window.setTimeout(() => {
        setStage('revealed')
        router.refresh()
      }, 700)
    } catch {
      setError('The chest did not open. Check your connection and try again.')
      setStage('idle')
    }
  }

  async function wear() {
    if (!actions || !shown || shown.kind === 'sticker' || wearBusy) return
    setWearBusy(true)
    const res = await actions.equip({ kind: shown.kind, id: worn ? null : shown.id }).catch(() => null)
    setWearBusy(false)
    if (res && res.ok) {
      playSfx('tap')
      setWorn(!worn)
      router.refresh()
    } else setError(res && !res.ok ? res.message : 'That did not work. Try again.')
  }

  const opening = stage === 'busy' && reward !== null

  return (
    <section aria-labelledby="chest-title" className={cx('flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-divider bg-surface px-4 py-4 md:px-6', className)}>
      <div className={cx('flex-none', state === 'ready' && stage === 'idle' && 'kira-chest-wiggle')}>
        <ChestArt open={opening || state === 'opened'} locked={state === 'locked'} />
      </div>
      <div className="flex min-w-0 flex-1 basis-56 flex-col items-start gap-2">
        <h2 id="chest-title" className="m-0 text-h2 font-bold">
          Daily chest
        </h2>
        {state === 'opened' && shown ? (
          <div role="status" className="kira-flip-in flex flex-wrap items-center gap-4">
            <span className="flex h-24 w-24 flex-none items-center justify-center rounded-card border-2 border-fg bg-bg">
              <RewardArt reward={shown} avatar={avatar} accessory={accessory} background={background} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-body-lg font-bold">
                {shown.isNew ? `You earned a new ${KIND_WORD[shown.kind]}` : 'You found this one again'}
              </span>
              <span className="text-body text-fg-muted">{shown.label}</span>
              {shown.kind !== 'sticker' && actions ? (
                <Button variant="secondary" size="M" loading={wearBusy} onClick={wear} aria-pressed={worn} className="self-start">
                  {worn ? 'Take it off' : 'Wear it'}
                </Button>
              ) : null}
            </span>
          </div>
        ) : (
          <>
            <p className="m-0 text-body text-fg-muted">{chest.line}</p>
            {state === 'ready' && actions ? (
              <Button variant="primary" size="M" loading={stage === 'busy'} onClick={open}>
                Open your chest
              </Button>
            ) : null}
          </>
        )}
        {error ? (
          <p role="alert" className="m-0 text-body font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
