'use client'

import { useState, type ReactElement } from 'react'
import { EggArt, PetArt, type PetArtKind } from '@kira/figures'
import { PET_KINDS, TREATS } from '@kira/core'
import { Icon } from '@kira/figures'
import type { ActionResult } from '@/lib/dto'
import type { PetDTO } from '@/lib/dto-world'
import { useT } from '@/lib/i18n/client'
import { itemName, treatLine, treatName } from '@/lib/i18n/dict/world'
import { Button } from '@/components/ui/Button'
import { cx } from '@/components/ui/cx'
import { LearnerFrame } from '@/components/learner/LearnerHeader'
import { playSfx } from '@/components/learner/sfx'
import { PetStage, StarCount, WorldTabs } from '@/components/learner/world/parts'
import type { IconName } from '@kira/figures'

export type PetActions = {
  choose: (input: { kind: string; name: string }) => Promise<ActionResult>
  treat: (input: { treatId: string; nonce: string }) => Promise<ActionResult<{ line: string; hearts: number }>>
  equip: (input: { kind: 'petcostume' | 'pethome'; id: string | null }) => Promise<ActionResult>
}

function Hatch({ actions }: { actions: PetActions }): ReactElement {
  const t = useT()
  const [kind, setKind] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'egg' | 'pick'>('egg')
  const save = async () => {
    if (!kind) return
    setBusy(true)
    setError(null)
    try {
      const res = await actions.choose({ kind, name })
      if (res.ok) playSfx('levelup')
      else setError(res.message)
    } catch {
      setError(t.world.pet.saveFailed)
    } finally {
      setBusy(false)
    }
  }
  if (step === 'egg')
    return (
      <section className="flex flex-col items-center gap-4 rounded-card border-2 border-fg bg-surface p-6 text-center">
        <EggArt cracked size={170} title={t.world.pet.crackingEgg} className="kw-animate" />
        <h2 className="m-0 text-h2 font-bold">{t.world.pet.readyTitle}</h2>
        <p className="m-0 max-w-[460px] text-body-lg text-fg-muted">{t.world.pet.readyLine}</p>
        <Button onClick={() => { playSfx('chest'); setStep('pick') }}>{t.world.pet.hatch}</Button>
      </section>
    )
  return (
    <section className="flex flex-col gap-4 rounded-card border-2 border-fg bg-surface p-4 md:p-6">
      <h2 className="m-0 text-h2 font-bold">{t.world.pet.choose}</h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3">
        {PET_KINDS.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={kind === p.id}
              onClick={() => { playSfx('tap'); setKind(p.id) }}
              className={cx('flex min-h-14 w-full cursor-pointer flex-col items-center gap-1 rounded-card border-2 bg-surface p-3', kind === p.id ? 'border-fg bg-star/20' : 'border-border hover:border-fg')}
            >
              <PetArt kind={p.id as PetArtKind} stage={1} size={92} />
              <span className="text-body-lg font-bold">{p.name}</span>
              <span className="text-small text-fg-muted">{t.world.petBlurbs[p.id]}</span>
            </button>
          </li>
        ))}
      </ul>
      <label className="flex flex-col gap-1.5 text-body-lg font-bold">
        {t.world.pet.nameLabel}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={12}
          autoComplete="off"
          className="h-14 rounded-control border-2 border-border bg-surface px-4 text-body-lg font-normal"
          placeholder={t.world.pet.namePlaceholder}
        />
      </label>
      {error ? <p role="alert" className="m-0 text-body font-bold text-danger">{error}</p> : null}
      <Button onClick={() => void save()} loading={busy} disabled={!kind || name.trim().length === 0}>
        {t.world.pet.meet}
      </Button>
    </section>
  )
}

function Care({ data, actions }: { data: PetDTO; actions: PetActions }): ReactElement {
  const t = useT()
  const pet = data.pet!
  const [line, setLine] = useState<string | null>(null)
  const [hearts, setHearts] = useState(pet.hearts)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cheer, setCheer] = useState(false)
  const give = async (treatId: string) => {
    setBusy(treatId)
    setError(null)
    try {
      const res = await actions.treat({ treatId, nonce: crypto.randomUUID() })
      if (res.ok) {
        playSfx('combo', { level: 2 })
        setLine(treatLine(t.world, treatId, res.data.line))
        setHearts(res.data.hearts)
        setCheer(true)
        setTimeout(() => setCheer(false), 1800)
      } else setError(res.message)
    } catch {
      setError(t.world.internetError)
    } finally {
      setBusy(null)
    }
  }
  const equip = async (kind: 'petcostume' | 'pethome', id: string | null) => {
    playSfx('tap')
    await actions.equip({ kind, id })
  }
  return (
    <div className="flex flex-col gap-4">
      <PetStage kind={pet.kind} stage={pet.stage} costume={pet.costume} home={pet.home} name={pet.name} line={line ?? data.greeting} happy={cheer} />
      <section className="flex flex-col gap-1 rounded-card border-2 border-divider bg-surface p-4">
        <h2 className="m-0 text-h3 font-bold">
          {t.world.pet.heading(pet.name, PET_KINDS.find((p) => p.id === pet.kind)?.name ?? '', t.world.petStages[pet.stage])}
        </h2>
        <p className="m-0 text-body text-fg-muted">
          {data.next ? t.world.pet.nextStage(data.next.left, pet.name, t.world.petStages[data.next.stage]) : t.world.pet.fullyGrown(pet.name)} {t.world.pet.treatsShared(hearts)}
        </p>
      </section>
      <section className="flex flex-col gap-3 rounded-card border-2 border-fg bg-surface p-4" aria-label={t.world.pet.treatsLabel}>
        <h2 className="m-0 text-h3 font-bold">{t.world.pet.feedAndPlay}</h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
          {TREATS.map((treat) => {
            const can = data.stars.balance >= treat.price
            const name = treatName(t.world, treat.id, treat.name)
            return (
              <li key={treat.id}>
                <button
                  type="button"
                  disabled={!can || busy !== null}
                  aria-label={`${name}, ${t.world.stars(treat.price)}`}
                  onClick={() => void give(treat.id)}
                  className="flex min-h-14 w-full cursor-pointer flex-col items-center gap-1 rounded-card border-2 border-border bg-surface p-3 enabled:hover:border-fg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name={treat.icon as IconName} size={40} />
                  <span className="text-body font-bold">{name}</span>
                  <span className="text-small font-bold tabular-nums">{t.world.stars(treat.price)}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {error ? <p role="alert" className="m-0 text-body font-bold text-danger">{error}</p> : null}
        <p className="m-0 text-small text-fg-muted">{t.world.pet.alwaysHappy(pet.name)}</p>
      </section>
      <section className="grid gap-3 md:grid-cols-2" aria-label={t.world.pet.styleLabel}>
        <div className="flex flex-col gap-2 rounded-card border-2 border-divider bg-surface p-4">
          <h2 className="m-0 text-h3 font-bold">{t.world.pet.home}</h2>
          <div className="flex flex-wrap gap-2">
            {data.homes.map((h) => (
              <Button key={h.id} size="M" variant={pet.home === h.id ? 'primary' : 'secondary'} aria-pressed={pet.home === h.id} onClick={() => void equip('pethome', h.id)}>
                {itemName(t.world, h.id, h.name)}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-card border-2 border-divider bg-surface p-4">
          <h2 className="m-0 text-h3 font-bold">{t.world.pet.costume}</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="M" variant={pet.costume === null ? 'primary' : 'secondary'} aria-pressed={pet.costume === null} onClick={() => void equip('petcostume', null)}>
              {t.world.pet.noCostume}
            </Button>
            {data.costumes.map((c) => (
              <Button key={c.id} size="M" variant={pet.costume === c.id ? 'primary' : 'secondary'} aria-pressed={pet.costume === c.id} onClick={() => void equip('petcostume', c.id)}>
                {itemName(t.world, c.id, c.name)}
              </Button>
            ))}
          </div>
          {data.costumes.length === 0 ? <p className="m-0 text-small text-fg-muted">{t.world.pet.costumesInShop}</p> : null}
        </div>
      </section>
    </div>
  )
}

export function PetScreen({ data, actions }: { data: PetDTO; actions: PetActions }): ReactElement {
  const t = useT()
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 min-w-0 flex-1 text-h1 font-bold">{t.world.pet.title}</h1>
        <StarCount stars={data.stars} />
      </header>
      <WorldTabs current="friend" />
      {data.state === 'egg' ? (
        <section className="flex flex-col items-center gap-3 rounded-card border-2 border-fg bg-surface p-6 text-center">
          <EggArt size={170} title={t.world.pet.sleepyEgg} className="kw-animate" />
          <h2 className="m-0 text-h2 font-bold">{t.world.pet.mysteryEgg}</h2>
          <p className="m-0 max-w-[460px] text-body-lg text-fg-muted">
            {t.world.pet.eggLine(data.hatchAt, data.stars.earned)}
          </p>
        </section>
      ) : data.state === 'ready' ? (
        <Hatch actions={actions} />
      ) : (
        <Care data={data} actions={actions} />
      )}
    </LearnerFrame>
  )
}
