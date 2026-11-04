'use client'

import { useId, useState } from 'react'
import { FEATURE_GROUPS, FEATURE_HINT, FEATURE_LABEL, FEATURE_NEEDS, FEATURE_PRESETS, featureOn, presetMap, type FeatureKey, type FeatureMap } from '@kira/core/features'
import { Button } from '@/components/console/Button'
import { ActionError } from '@/components/console/Feedback'
import { useAction } from '@/components/console/useAction'
import { parentSaveFeaturesAction } from '@/server/actions/parent'

/**
 * Saklar fitur per anak untuk orang tua: kelompok Mapel harian, Olimpiade, Drill dan latihan, Lainnya, dengan tiga preset.
 * Tiap baris menjelaskan satu kalimat apa yang dilakukannya. Semua menyala bawaan. Penyimpanan lewat aksi orang tua; server
 * yang menegakkan pilihan. Dipakai di halaman anak dan di onboarding (Atur sendiri).
 */
export function FeatureChecklist({
  learnerId,
  name,
  initial,
  onSaved,
  saveLabel = 'Simpan pilihan fitur',
  primary = false,
  showPresets = true,
}: {
  learnerId: string
  name: string
  initial: FeatureMap
  onSaved?: () => void | Promise<void>
  saveLabel?: string
  primary?: boolean
  showPresets?: boolean
}) {
  const [map, setMap] = useState<FeatureMap>(initial)
  const [saved, setSaved] = useState(false)
  const save = useAction(parentSaveFeaturesAction)
  const gid = useId().replace(/:/g, '')
  const toggle = (k: FeatureKey, on: boolean) => {
    setSaved(false)
    setMap((m) => ({ ...m, [k]: on }))
  }
  return (
    <div className="flex flex-col gap-4">
      {showPresets ? (
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
                className="h-11 cursor-pointer rounded-control border-2 border-border bg-surface px-4 text-body font-bold"
              >
                {p.title}
              </button>
            ))}
          </div>
          <p className="m-0 text-small text-fg-muted">Pilihan cepat hanya mengisi saklar di bawah. Kamu masih bisa mengubahnya sebelum menyimpan.</p>
        </div>
      ) : null}
      {FEATURE_GROUPS.map((g) => (
        <fieldset key={g.id} className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
          <legend className="mb-1 p-0 text-body font-bold">{g.title}</legend>
          <div className="flex flex-col divide-y divide-divider overflow-hidden rounded-control border-2 border-divider bg-surface">
            {g.keys.map((k) => {
              const need = FEATURE_NEEDS[k]
              const blocked = need ? !featureOn(map, need) : false
              const tid = `${gid}-${k}`
              return (
                <label key={k} className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span id={tid} className="text-body font-bold">
                      {FEATURE_LABEL[k]}
                    </span>
                    <span id={`${tid}-d`} className="text-small text-fg-muted">
                      {blocked && need ? `Menyala bila ${FEATURE_LABEL[need]} menyala.` : FEATURE_HINT[k]}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    className="kira-toggle"
                    aria-labelledby={tid}
                    aria-describedby={`${tid}-d`}
                    checked={featureOn(map, k)}
                    disabled={blocked}
                    onChange={(e) => toggle(k, e.target.checked)}
                  />
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      <ActionError error={save.error} />
      {saved ? (
        <p role="status" className="m-0 text-body font-bold">
          Pilihan {name} tersimpan. Hari ini ikut menyesuaikan.
        </p>
      ) : null}
      <Button
        variant={primary ? 'primary' : 'secondary'}
        className={primary ? 'h-12 w-full' : 'h-12 self-start'}
        loading={save.pending}
        onClick={async () => {
          const r = await save.run({ learnerId, features: map })
          if (r.ok) {
            setSaved(true)
            await onSaved?.()
          }
        }}
      >
        {saveLabel}
      </Button>
    </div>
  )
}
