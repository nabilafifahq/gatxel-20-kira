'use client'

import { useState, type FormEvent } from 'react'
import type { ActionResult, ConsoleShell } from '@/lib/dto'
import type { MedalDTO } from '@/lib/dto-world'
import { Button } from '@/components/console/Button'
import { RequiredMark, RequiredNote } from '@/components/console/Field'
import { FamilyShell } from '@/components/family/FamilyShell'

/**
 * Orang tua mencatat medali lomba sungguhan. Medali tampil di Ruang piala anak dengan kilau.
 * Sertifikat milestone 7, 30, dan 100 hari ada di Ruang piala anak sebagai PDF yang bisa dicetak.
 */

const LABEL: Record<MedalDTO['medal'], string> = { gold: 'Medali emas', silver: 'Medali perak', bronze: 'Medali perunggu', honour: 'Penghargaan khusus', participant: 'Peserta' }

export type MedalsData = { shell: ConsoleShell; children: { id: string; name: string; medals: MedalDTO[] }[] }
export type MedalsActions = {
  add: (input: { learnerId: string; title: string; medal: MedalDTO['medal']; earnedOn: string }) => Promise<ActionResult>
  remove: (input: { learnerId: string; medalId: string }) => Promise<ActionResult>
}

function Child({ child, actions }: { child: MedalsData['children'][number]; actions: MedalsActions }) {
  const [title, setTitle] = useState('')
  const [medal, setMedal] = useState<MedalDTO['medal']>('gold')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await actions.add({ learnerId: child.id, title, medal, earnedOn: date })
      if (r.ok) setTitle('')
      else setError(r.message)
    } catch {
      setError('Belum tersimpan. Periksa koneksi lalu coba lagi.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section aria-label={`Medali ${child.name}`} className="flex flex-col gap-3 rounded-card border border-divider bg-surface p-4">
      <h2 className="m-0 text-h3 font-bold">{child.name}</h2>
      {child.medals.length === 0 ? <p className="m-0 text-body text-fg-muted">Belum ada medali yang dicatat.</p> : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {child.medals.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-control border border-divider px-3 py-2">
            <span className="min-w-0 flex-1 text-body">
              <strong>{m.title}</strong>, {LABEL[m.medal]}, {m.earnedOn}
            </span>
            <Button variant="secondary" size="S" onClick={() => void actions.remove({ learnerId: child.id, medalId: m.id })}>
              Hapus
            </Button>
          </li>
        ))}
      </ul>
      <RequiredNote />
      <form onSubmit={(e) => void submit(e)} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-small font-bold">
          <span>
            Nama lomba
            <RequiredMark />
          </span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required className="h-11 rounded-control border border-border bg-surface px-3 text-body font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-small font-bold">
          Medali
          <select value={medal} onChange={(e) => setMedal(e.target.value as MedalDTO['medal'])} className="h-11 rounded-control border border-border bg-surface px-3 text-body font-normal">
            {(Object.keys(LABEL) as MedalDTO['medal'][]).map((k) => (
              <option key={k} value={k}>
                {LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small font-bold">
          <span>
            Tanggal
            <RequiredMark />
          </span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-11 rounded-control border border-border bg-surface px-3 text-body font-normal" />
        </label>
        <Button type="submit" loading={busy}>
          Catat medali
        </Button>
      </form>
      {error ? (
        <p role="alert" className="m-0 text-body font-bold text-danger">
          {error}
        </p>
      ) : null}
    </section>
  )
}

export function MedalsScreen({ data, actions }: { data: MedalsData; actions: MedalsActions }) {
  return (
    <FamilyShell shell={data.shell} active="home">
      <h1 className="m-0 text-h2 font-bold">Medali lomba</h1>
      <p className="m-0 text-body text-fg-muted">Catat medali dari lomba sungguhan. Medali muncul di Ruang piala anak dan menjadi kejutan manis di sana.</p>
      {data.children.map((c) => (
        <Child key={c.id} child={c} actions={actions} />
      ))}
    </FamilyShell>
  )
}
