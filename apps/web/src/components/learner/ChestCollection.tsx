'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactElement } from 'react'
import { Avatar, Icon, type IconName } from '@kira/figures'
import type { ActionResult, AvatarName } from '@/lib/dto'
import type { CollectionDTO } from '@/lib/dto-motion'
import { cx } from '@/components/ui/cx'
import { playSfx } from './sfx'

/**
 * Koleksi dari peti hadiah harian di halaman Me: stiker yang sudah didapat, latar avatar, dan aksesori
 * peti. Yang belum didapat tampil sebagai kotak kosong dengan teks "Earn it from the daily chest".
 * Latar dan aksesori bisa dipakai atau dilepas dengan satu ketukan.
 */
export function ChestCollection({
  collection,
  avatar,
  accessory,
  background,
  equip,
}: {
  collection: CollectionDTO
  avatar: AvatarName
  accessory: string | null
  background: string | null
  equip?: (input: { kind: 'accessory' | 'background'; id: string | null }) => Promise<ActionResult>
}): ReactElement {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const earnedCount = collection.stickers.filter((s) => s.owned).length + collection.backgrounds.filter((b) => b.owned).length + collection.accessories.filter((a) => a.owned).length
  const total = collection.stickers.length + collection.backgrounds.length + collection.accessories.length

  async function wear(kind: 'accessory' | 'background', id: string | null) {
    if (!equip || busy) return
    setBusy(true)
    setError(null)
    const res = await equip({ kind, id }).catch(() => null)
    setBusy(false)
    if (res && res.ok) {
      playSfx('tap')
      router.refresh()
    } else setError(res && !res.ok ? res.message : 'That did not save. Check the internet and try again.')
  }

  const cell = 'flex min-h-28 flex-col items-center justify-center gap-1 rounded-control border-2 p-2 text-center'
  return (
    <section aria-labelledby="me-chest" className="flex flex-col gap-4 rounded-card border border-divider bg-surface p-5 md:p-7">
      <div className="flex flex-wrap items-baseline gap-x-4">
        <h2 id="me-chest" className="m-0 text-h2 font-bold">
          Chest collection
        </h2>
        <span className="text-body font-semibold text-fg-muted tabular-nums">
          {earnedCount} of {total} earned
        </span>
      </div>
      <p className="m-0 text-body-lg text-fg-muted">Open your daily chest after your sessions to earn something new.</p>

      <h3 className="m-0 text-h3 font-bold">Stickers</h3>
      <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-6">
        {collection.stickers.map((s) => (
          <li key={s.id} className={cx(cell, s.owned ? 'border-border bg-surface' : 'border-dashed border-divider bg-bg')}>
            {s.owned ? <Icon name={s.id as IconName} size={56} /> : <span aria-hidden="true" className="h-14 w-14 rounded-pill bg-divider" />}
            <span className={cx('text-small font-semibold', !s.owned && 'text-fg-muted')}>{s.owned ? s.label : 'Not earned yet'}</span>
          </li>
        ))}
      </ul>

      <h3 className="m-0 text-h3 font-bold">Avatar backgrounds</h3>
      <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-6">
        {collection.backgrounds.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              disabled={!b.owned || busy || !equip}
              aria-pressed={b.equipped}
              onClick={() => void wear('background', b.equipped ? null : b.id)}
              className={cx(cell, 'w-full cursor-pointer disabled:cursor-default', b.equipped ? 'border-3 border-fg bg-bg' : b.owned ? 'border-border bg-surface hover:border-fg' : 'border-dashed border-divider bg-bg')}
            >
              {b.owned ? <Avatar name={avatar} accessory={accessory} background={b.id} size={56} /> : <span aria-hidden="true" className="h-14 w-14 rounded-pill bg-divider" />}
              <span className={cx('text-small font-semibold', !b.owned && 'text-fg-muted')}>{b.owned ? `${b.label}${b.equipped ? ', worn' : ''}` : 'Not earned yet'}</span>
            </button>
          </li>
        ))}
      </ul>

      <h3 className="m-0 text-h3 font-bold">Chest accessories</h3>
      <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-6">
        {collection.accessories.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              disabled={!a.owned || busy || !equip}
              aria-pressed={a.equipped}
              onClick={() => void wear('accessory', a.equipped ? null : a.id)}
              className={cx(cell, 'w-full cursor-pointer disabled:cursor-default', a.equipped ? 'border-3 border-fg bg-bg' : a.owned ? 'border-border bg-surface hover:border-fg' : 'border-dashed border-divider bg-bg')}
            >
              {a.owned ? <Avatar name={avatar} accessory={a.id} background={background} size={56} /> : <span aria-hidden="true" className="h-14 w-14 rounded-pill bg-divider" />}
              <span className={cx('text-small font-semibold', !a.owned && 'text-fg-muted')}>{a.owned ? `${a.label}${a.equipped ? ', worn' : ''}` : 'Not earned yet'}</span>
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="m-0 text-body font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </section>
  )
}
