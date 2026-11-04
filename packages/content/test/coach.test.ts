import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadCoachActivities, pickActivity, STRAND_PLAIN } from '../src/coach'
import { loadContent } from '../src/load'
import { STRAND_NAMES } from '../src/schema'

const dir = join(__dirname, '../../../content')
const { activities, errors } = loadCoachActivities(dir)
const { index } = loadContent(dir)

describe('pustaka kegiatan Pelatih Orang Tua', () => {
  it('semua berkas valid dan jumlahnya cukup', () => {
    expect(errors).toEqual([])
    expect(activities.length).toBeGreaterThanOrEqual(60)
    for (const subject of ['math', 'english', 'science'] as const) expect(activities.filter((a) => a.subject === subject).length).toBeGreaterThanOrEqual(15)
  })

  it('setiap kelas 1 sampai 6 punya kegiatan di setiap mapel', () => {
    for (const subject of ['math', 'english', 'science'] as const)
      for (let g = 1; g <= 6; g++) expect(activities.filter((a) => a.subject === subject && a.gradeMin <= g && g <= a.gradeMax).length, `${subject} kelas ${g}`).toBeGreaterThanOrEqual(5)
  })

  it('setiap skill non-olimpiade bisa dipasangkan dengan kegiatan yang cocok strand-nya dan kelasnya dekat', () => {
    const missing: string[] = []
    for (const s of index.skills.values()) {
      if (s.strand === 'Oly') continue
      const a = pickActivity(activities, { subject: s.subject, strand: s.strand, grade: s.grade })
      if (!a || !a.strands.includes(s.strand)) missing.push(`${s.id} (${s.strand})`)
      else if (s.grade < a.gradeMin - 1 || s.grade > a.gradeMax + 1) missing.push(`${s.id} kelas ${s.grade} jauh dari ${a.id}`)
    }
    expect(missing).toEqual([])
  })

  it('kegiatan aman dan teksnya bersih', () => {
    const banned = /\b(api|kompor|korek|silet|mendidih|menyala|stopkontak|colokan|pecahan kaca|unlock)\b/i
    for (const a of activities) {
      const all = [a.title, a.ask, a.easier, ...a.materials, ...a.steps].join(' ')
      expect(all, a.id).not.toMatch(banned)
      expect(all, a.id).not.toMatch(/[–—]/)
      expect(all, a.id).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(all, a.id).not.toMatch(/;/)
    }
  })

  it('penjelasan sehari-hari ada untuk setiap strand yang dipakai skill', () => {
    for (const code of Object.keys(STRAND_NAMES)) expect(STRAND_PLAIN[code], code).toBeTruthy()
  })

  it('pilihan berputar tiap minggu dan menghindari kegiatan yang baru dipakai', () => {
    const q = { subject: 'math', strand: 'Ni', grade: 3 } as const
    const a = pickActivity(activities, q, new Set(), 0)!
    const b = pickActivity(activities, q, new Set([a.id]), 0)!
    expect(b.id).not.toBe(a.id)
    const rotated = new Set([0, 1, 2, 3].map((n) => pickActivity(activities, q, new Set(), n)!.id))
    expect(rotated.size).toBeGreaterThan(1)
  })
})
