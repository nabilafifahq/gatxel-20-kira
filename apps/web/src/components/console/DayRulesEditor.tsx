'use client'

import { useState } from 'react'
import { DAY_PRESET_LABEL_ID, RULE_LEVEL_LABEL_ID, RULE_SESSIONS, RULE_WEEKDAYS, SUBJECTS, detectPreset, normaliseRules, presetRules, type DayPreset } from '@kira/core'
import type { ActionResult, DayPresetId, DayRulesDTO, PlanChangeResult, RuleLevelId } from '@/lib/dto'
import { Button } from './Button'
import { ConfirmDialog } from './Dialog'
import { ActionError, InlineAlert } from './Feedback'
import { useAction } from './useAction'
import { cx } from './cx'

/**
 * Aturan hari bawaan satu learner, dipakai konsol tutor dan dashboard orang tua. Preset (Penuh, Seimbang,
 * Ringan) atau Kustom per hari, mapel, dan sesi: Mati, Opsional, atau Wajib. Hanya sesi Wajib yang
 * dihitung untuk streak.
 */

const DAY_NAME: Record<string, string> = { '1': 'Senin', '2': 'Selasa', '3': 'Rabu', '4': 'Kamis', '5': 'Jumat', '6': 'Sabtu' }
const SUBJECT_NAME: Record<string, string> = { math: 'Math', english: 'English', science: 'Science' }
const SESSION_NAME: Record<string, string> = { latihan: 'Latihan', tes: 'Tes', paper: 'Paper' }
const PRESET_HINT: Record<Exclude<DayPreset, 'kustom'>, string> = {
  penuh: 'Semua sesi wajib: 9 sesi per hari, hari belajar paling padat.',
  seimbang: 'Latihan wajib. Tes dan Paper boleh dikerjakan kalau sempat dan tidak memutus streak.',
  ringan: 'Hanya Latihan, satu per mapel. Cocok untuk hari yang sibuk atau saat anak kurang sehat.',
}
const LEVELS: RuleLevelId[] = ['required', 'optional', 'off']

/** Kalimat hasil perubahan yang mengenai hari ini; null bila hari ini belum punya sesi. */
export function changeMessage(c: PlanChangeResult): string | null {
  if (!c.today) return null
  const parts: string[] = []
  if (c.created) parts.push(`${c.created} sesi ditambahkan`)
  if (c.removed) parts.push(`${c.removed} sesi yang belum dimulai dihapus`)
  if (c.regenerated) parts.push(`${c.regenerated} sesi yang belum dimulai diganti isinya`)
  if (c.kept) parts.push(`${c.kept} sesi yang sudah dimulai tetap utuh, hanya status wajib atau opsionalnya yang bisa berubah`)
  return parts.length > 0 ? `Hari ini ikut berubah: ${parts.join(', ')}. Layar Hari Ini anak menyesuaikan saat dimuat berikutnya.` : 'Hari ini sudah sesuai aturan baru.'
}

export function DayRulesEditor({
  learnerName,
  preset: initialPreset,
  rules: initialRules,
  onSave,
}: {
  learnerName: string
  preset: DayPresetId
  rules: DayRulesDTO | undefined
  onSave: (input: { preset: DayPresetId; rules: DayRulesDTO | null }) => Promise<ActionResult<PlanChangeResult>>
}) {
  const [preset, setPreset] = useState<DayPreset>(initialPreset)
  const [rules, setRules] = useState<DayRulesDTO>(() => (initialRules ? (normaliseRules(initialRules) as DayRulesDTO) : (presetRules(initialPreset) as DayRulesDTO)))
  const [note, setNote] = useState<string | null>(null)
  const save = useAction(onSave)

  function choose(p: DayPreset) {
    setPreset(p)
    setNote(null)
    if (p !== 'kustom') setRules(presetRules(p) as DayRulesDTO)
  }
  function setCell(day: string, subject: string, session: string, level: RuleLevelId) {
    const next = structuredClone(rules) as Record<string, Record<string, Record<string, RuleLevelId>>>
    next[day]![subject]![session] = level
    setRules(next as DayRulesDTO)
    setNote(null)
  }
  function copyMonday() {
    setRules(Object.fromEntries(RULE_WEEKDAYS.map((d) => [String(d), structuredClone(rules['1']!)])) as DayRulesDTO)
    setNote(null)
  }
  async function doSave() {
    const effective = preset === 'kustom' ? detectPreset(normaliseRules(rules)) : preset
    const r = await save.run({ preset: effective === 'kustom' ? 'kustom' : effective, rules: effective === 'kustom' ? rules : null })
    if (r.ok) setNote(changeMessage(r.data) ?? `Aturan hari ${learnerName} tersimpan. Berlaku untuk hari-hari berikutnya.`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={`Aturan hari ${learnerName}`} className="grid gap-2 sm:grid-cols-2">
        {(['seimbang', 'penuh', 'ringan', 'kustom'] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={preset === p}
            onClick={() => choose(p)}
            className={cx('flex min-h-11 flex-col gap-0.5 rounded-control border-2 bg-surface p-3 text-left', preset === p ? 'border-fg' : 'border-border hover:border-fg')}
          >
            <span className="text-body font-bold">{DAY_PRESET_LABEL_ID[p]}</span>
            <span className="text-small text-fg-muted">{p === 'kustom' ? 'Atur sendiri per hari, mapel, dan sesi.' : PRESET_HINT[p]}</span>
          </button>
        ))}
      </div>
      {preset === 'kustom' ? (
        <div className="flex flex-col gap-3">
          <Button variant="secondary" size="S" className="self-start" onClick={copyMonday}>
            Samakan semua hari dengan Senin
          </Button>
          {RULE_WEEKDAYS.map((d) => (
            <details key={d} className="rounded-control border border-divider p-3">
              <summary className="cursor-pointer text-body font-bold">{DAY_NAME[String(d)]}</summary>
              <div className="mt-3 flex flex-col gap-3">
                {SUBJECTS.map((s) => (
                  <div key={s} className="flex flex-col gap-1.5">
                    <span className="text-small font-bold">{SUBJECT_NAME[s]}</span>
                    <div className="grid grid-cols-3 gap-2">
                      {RULE_SESSIONS.map((k) => (
                        <label key={k} className="flex min-w-0 flex-col gap-1 text-small text-fg-muted">
                          {SESSION_NAME[k]}
                          <select
                            className="h-11 min-w-0 rounded-control border-2 border-border bg-surface px-2 text-body text-fg"
                            value={rules[String(d)]![s]![k]}
                            onChange={(e) => setCell(String(d), s, k, e.target.value as RuleLevelId)}
                          >
                            {LEVELS.map((l) => (
                              <option key={l} value={l}>
                                {RULE_LEVEL_LABEL_ID[l]}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {d === 6 ? <span className="text-small text-fg-muted">Paper penuh hari Sabtu hanya dibuat kalau Paper tidak Mati.</span> : null}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="m-0 text-small text-fg-muted">Streak hanya menghitung sesi yang Wajib. Hari tanpa sesi wajib tidak memutus streak.</p>
      )}
      {note ? <InlineAlert tone="success" title={note} /> : null}
      <ActionError error={save.error} />
      <Button variant="primary" className="self-start" onClick={doSave} loading={save.pending}>
        Simpan aturan hari
      </Button>
    </div>
  )
}

/** Atur ulang streak satu learner dengan konfirmasi nama. Hanya riwayat hari dan pembeku; XP dan jawaban tetap. */
export function StreakResetControl({
  learnerName,
  streak,
  onReset,
}: {
  learnerName: string
  streak: number | undefined
  onReset: (input: { confirmName: string }) => Promise<ActionResult<{ removedDays: number; streakBefore: number }>>
}) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const act = useAction(onReset)

  async function go() {
    const r = await act.run({ confirmName: learnerName })
    if (r.ok) {
      setOpen(false)
      setDone(`Streak ${learnerName} dimulai dari nol hari ini. ${r.data.removedDays} hari riwayat dihapus. XP, lencana, dan jawaban tidak berubah.`)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-small text-fg-muted">
        Streak sekarang: {streak ?? 0} hari. Mengatur ulang menghapus riwayat hari dan pembeku streak {learnerName}, lalu menghitung hari ini lagi. XP, lencana, penguasaan skill, dan jawaban tetap ada.
      </p>
      {done ? <InlineAlert tone="success" title={done} /> : null}
      <Button variant="secondary" size="S" tone="danger" className="self-start" onClick={() => (act.reset(), setDone(null), setOpen(true))}>
        Atur ulang streak
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Atur ulang streak ${learnerName}?`}
        body={`Streak ${streak ?? 0} hari akan dimulai lagi dari nol. Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Atur ulang streak"
        confirmText={learnerName}
        confirmTextLabel={`Ketik ${learnerName} untuk mengonfirmasi`}
        onConfirm={go}
        error={act.error ? act.error.message : undefined}
      />
    </div>
  )
}
