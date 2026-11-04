'use client'

import { useState, type ReactElement } from 'react'
import { EggArt, PetArt, type PetArtKind } from '@kira/figures'
import { PET_KINDS, PET_STAGE_NAMES, TREATS } from '@kira/core'
import { Icon } from '@kira/figures'
import type { ActionResult } from '@/lib/dto'
import type { PetDTO } from '@/lib/dto-world'
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
      setError('That did not save. Check the internet and try again.')
    } finally {
      setBusy(false)
    }
  }
  if (step === 'egg')
    return (
      <section className="flex flex-col items-center gap-4 rounded-card border-2 border-fg bg-surface p-6 text-center">
        <EggArt cracked size={170} title="A cracking egg" className="kw-animate" />
        <h2 className="m-0 text-h2 font-bold">Your egg is ready to hatch</h2>
        <p className="m-0 max-w-[460px] text-body-lg text-fg-muted">Six friends are waiting inside. Pick the one you like best.</p>
        <Button onClick={() => { playSfx('chest'); setStep('pick') }}>Hatch the egg</Button>
      </section>
    )
  return (
    <section className="flex flex-col gap-4 rounded-card border-2 border-fg bg-surface p-4 md:p-6">
      <h2 className="m-0 text-h2 font-bold">Choose your friend</h2>
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
              <span className="text-small text-fg-muted">{p.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <label className="flex flex-col gap-1.5 text-body-lg font-bold">
        What will you call your friend?
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={12}
          autoComplete="off"
          className="h-14 rounded-control border-2 border-border bg-surface px-4 text-body-lg font-normal"
          placeholder="A name up to 12 letters"
        />
      </label>
      {error ? <p role="alert" className="m-0 text-body font-bold text-danger">{error}</p> : null}
      <Button onClick={() => void save()} loading={busy} disabled={!kind || name.trim().length === 0}>
        Meet your friend
      </Button>
    </section>
  )
}

function Care({ data, actions }: { data: PetDTO; actions: PetActions }): ReactElement {
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
        setLine(res.data.line)
        setHearts(res.data.hearts)
        setCheer(true)
        setTimeout(() => setCheer(false), 1800)
      } else setError(res.message)
    } catch {
      setError('That did not work. Check the internet and try again.')
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
          {pet.name} the {PET_KINDS.find((p) => p.id === pet.kind)?.name} · {PET_STAGE_NAMES[pet.stage - 1]}
        </h2>
        <p className="m-0 text-body text-fg-muted">
          {data.next ? `${data.next.left} more required ${data.next.left === 1 ? 'session' : 'sessions'} and ${pet.name} grows into a ${PET_STAGE_NAMES[data.next.stage - 1]}.` : `${pet.name} is fully grown. Great work!`} {hearts} treats shared so far.
        </p>
      </section>
      <section className="flex flex-col gap-3 rounded-card border-2 border-fg bg-surface p-4" aria-label="Treats">
        <h2 className="m-0 text-h3 font-bold">Feed and play</h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
          {TREATS.map((t) => {
            const can = data.stars.balance >= t.price
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={!can || busy !== null}
                  aria-label={`${t.name}, ${t.price} stars`}
                  onClick={() => void give(t.id)}
                  className="flex min-h-14 w-full cursor-pointer flex-col items-center gap-1 rounded-card border-2 border-border bg-surface p-3 enabled:hover:border-fg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name={t.icon as IconName} size={40} />
                  <span className="text-body font-bold">{t.name}</span>
                  <span className="text-small font-bold tabular-nums">{t.price} stars</span>
                </button>
              </li>
            )
          })}
        </ul>
        {error ? <p role="alert" className="m-0 text-body font-bold text-danger">{error}</p> : null}
        <p className="m-0 text-small text-fg-muted">{pet.name} is always happy to see you, even after a long break.</p>
      </section>
      <section className="grid gap-3 md:grid-cols-2" aria-label="Style">
        <div className="flex flex-col gap-2 rounded-card border-2 border-divider bg-surface p-4">
          <h2 className="m-0 text-h3 font-bold">Home</h2>
          <div className="flex flex-wrap gap-2">
            {data.homes.map((h) => (
              <Button key={h.id} size="M" variant={pet.home === h.id ? 'primary' : 'secondary'} aria-pressed={pet.home === h.id} onClick={() => void equip('pethome', h.id)}>
                {h.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-card border-2 border-divider bg-surface p-4">
          <h2 className="m-0 text-h3 font-bold">Costume</h2>
          <div className="flex flex-wrap gap-2">
            <Button size="M" variant={pet.costume === null ? 'primary' : 'secondary'} aria-pressed={pet.costume === null} onClick={() => void equip('petcostume', null)}>
              None
            </Button>
            {data.costumes.map((c) => (
              <Button key={c.id} size="M" variant={pet.costume === c.id ? 'primary' : 'secondary'} aria-pressed={pet.costume === c.id} onClick={() => void equip('petcostume', c.id)}>
                {c.name}
              </Button>
            ))}
          </div>
          {data.costumes.length === 0 ? <p className="m-0 text-small text-fg-muted">Costumes are in the Star Shop.</p> : null}
        </div>
      </section>
    </div>
  )
}

export function PetScreen({ data, actions }: { data: PetDTO; actions: PetActions }): ReactElement {
  return (
    <LearnerFrame shell={data.shell} current="world" className="flex flex-col gap-4 md:gap-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 min-w-0 flex-1 text-h1 font-bold">Your friend</h1>
        <StarCount stars={data.stars} />
      </header>
      <WorldTabs current="friend" />
      {data.state === 'egg' ? (
        <section className="flex flex-col items-center gap-3 rounded-card border-2 border-fg bg-surface p-6 text-center">
          <EggArt size={170} title="A sleepy egg" className="kw-animate" />
          <h2 className="m-0 text-h2 font-bold">A mystery egg</h2>
          <p className="m-0 max-w-[460px] text-body-lg text-fg-muted">
            Earn {data.hatchAt} stars from your sessions and the egg will start to hatch. You have earned {data.stars.earned} so far.
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
