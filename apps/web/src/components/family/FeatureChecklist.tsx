'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FEATURE_GROUPS, FEATURE_LABEL, FEATURE_PRESETS, featureOn, presetMap, type FeatureKey, type FeatureMap } from '@kira/core/features'
import { Button } from '@/components/console/Button'
import { ActionError } from '@/components/console/Feedback'
import { Checkbox } from '@/components/console/Field'
import { useAction } from '@/components/console/useAction'
import { parentSaveFeaturesAction } from '@/server/actions/parent'

/**
 * Daftar centang fitur per anak untuk orang tua: kelompok Mapel harian, Olimpiade, Drill dan latihan, Lainnya,
 * dengan tiga preset. Semua menyala bawaan. Penyimpanan lewat aksi orang tua; server yang menegakkan pilihan.
 */
export function FeatureChecklist({ learnerId, name, initial, onSaved }: { learnerId: string; name: string; initial: FeatureMap; onSaved?: () => void }) {
  const router = useRouter()
  const [map, setMap] = useState<FeatureMap>(initial)
  const [saved, setSaved] = useState(false)
  const save = useAction(parentSaveFeaturesAction)
  const toggle = (k: FeatureKey, on: boolean) => {
    setSaved(false)
    setMap((m) => ({ ...m, [k]: on }))
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="m-0 text-small font-bold">Pilihan cepat</p>
        <div className="flex flex-wrap gap-2">
          {FEATURE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              onClick={() => {
                setSaved(false)
                setMap(presetMap(p.id))
              }}
              className="h-11 rounded-control border-2 border-border bg-surface px-4 text-body font-bold"
            >
              {p.title}
            </button>
          ))}
        </div>
        <p className="m-0 text-small text-fg-muted">Pilihan cepat hanya mengisi centang di bawah. Kamu masih bisa mengubahnya sebelum menyimpan.</p>
      </div>
      {FEATURE_GROUPS.map((g) => (
        <fieldset key={g.id} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-body font-bold">{g.title}</legend>
          {g.keys.map((k) => (
            <Checkbox key={k} checked={featureOn(map, k)} onChange={(e) => toggle(k, e.target.checked)} label={FEATURE_LABEL[k]} />
          ))}
        </fieldset>
      ))}
      <ActionError error={save.error} />
      {saved ? (
        <p role="status" className="m-0 text-body font-bold">
          Pilihan {name} tersimpan. Hari ini ikut menyesuaikan.
        </p>
      ) : null}
      <Button
        variant="secondary"
        className="h-12 self-start"
        loading={save.pending}
        onClick={async () => {
          const r = await save.run({ learnerId, features: map })
          if (r.ok) {
            setSaved(true)
            router.refresh()
            onSaved?.()
          }
        }}
      >
        Simpan pilihan fitur
      </Button>
    </div>
  )
}
