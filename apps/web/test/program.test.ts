import { describe, expect, it } from 'vitest'
import { weekday } from '@kira/core'
import { allPrograms, planProgramSlots, programById } from '@/server/dal/console-program'
import { isRestDate } from '@/server/dal/planner-logic'

const math = programById('olimpiade-math-g2')!

describe('program olimpiade di perencana', () => {
  it('tiga program kelas 2 tersedia: Math, English, Science', () => {
    expect(allPrograms().map((p) => p.id).sort()).toEqual(['olimpiade-english-g2', 'olimpiade-math-g2', 'olimpiade-science-g2'])
  })

  it('tanpa hari istirahat dan tanpa bentrok: dua slot per hari selama 56 hari, kecuali hari ringan', () => {
    const r = planProgramSlots(math, '2026-10-21', () => false, new Set())
    // 53 hari biasa x 2 slot + 3 hari ringan x 1 slot.
    expect(r.slots).toHaveLength(53 * 2 + 3)
    expect(r.restDaysSkipped).toBe(0)
    expect(r.conflictsSkipped).toBe(0)
    expect(r.simulations).toBe(2)
    expect(r.slots.filter((s) => s.mode === 'tes').length).toBe(53)
  })

  it('hari istirahat mingguan dilewati', () => {
    // Minggu (0) hari istirahat.
    const r = planProgramSlots(math, '2026-10-21', (d) => isRestDate(d, [0], new Map()), new Set())
    expect(r.restDaysSkipped).toBe(8)
    expect(r.slots.every((s) => weekday(s.date) !== 0)).toBe(true)
  })

  it('slot tutor di mapel, hari, dan mode yang sama dipertahankan dan dilaporkan sebagai bentrok', () => {
    const r = planProgramSlots(math, '2026-10-21', () => false, new Set(['2026-10-21:math:latihan', '2026-10-22:math:tes']))
    expect(r.conflictsSkipped).toBe(2)
    expect(r.slots.some((s) => s.date === '2026-10-21' && s.mode === 'latihan')).toBe(false)
    expect(r.slots.some((s) => s.date === '2026-10-21' && s.mode === 'tes')).toBe(true)
  })

  it('Sabtu simulasi yang jatuh di hari istirahat tidak dihitung', () => {
    const r = planProgramSlots(math, '2026-10-21', (d) => weekday(d) === 6, new Set())
    expect(r.simulations).toBe(0)
  })

  it('setiap slot memakai skill yang cocok dengan mapel dan Grade program', () => {
    for (const p of allPrograms()) {
      const r = planProgramSlots(p, '2026-10-21', () => false, new Set())
      for (const s of r.slots) {
        expect(s.subject).toBe(p.subject)
        expect(s.skillId.startsWith(`${p.subject[0]}${p.grade}.`)).toBe(true)
        expect(s.questionCount).toBeGreaterThanOrEqual(4)
      }
    }
  })
})
