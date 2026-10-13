import { describe, expect, it } from 'vitest'
import { weekday } from '@kira/core'
import { checkExtras, loadMedals, loadPrograms, loadRegistry } from '../src/extras'
import { findContentDir, loadContent } from '../src/load'
import { medalFor, medalLine, type MedalEntry } from '../src/medals'
import { expandProgram, programPosition, programSkillIds, PROGRAM_DAYS, programSchema } from '../src/programs'
import { allowedHosts, attributionLine, canAutoFetch, canCommitToRepo, registrySchema, sourceSchema, sourceTag, LICENSE_POLICY, type LicenseId } from '../src/sources'

const dir = findContentDir()
const { index } = loadContent(dir)

describe('berkas konten tambahan', () => {
  it('registri, program, dan medali lolos content:check', () => {
    expect(checkExtras(dir, index)).toEqual([])
  })

  it('ada tiga program olimpiade kelas 2: Math, English, Science', () => {
    const { programs } = loadPrograms(dir)
    expect(programs.map((p) => p.subject).sort()).toEqual(['english', 'math', 'science'])
    for (const p of programs) {
      expect(p.grade).toBe(2)
      expect(programSkillIds(p).every((id) => index.skills.has(id))).toBe(true)
    }
  })
})

describe('registri sumber: aturan lisensi', () => {
  const base = {
    id: 'contoh',
    name: 'Contoh',
    site: 'https://example.org',
    subjects: ['math'],
    grades: [2],
    license: 'mit',
    attribution: 'Penulis (2020), Contoh.',
    format: 'json',
    access: 'auto',
    importer: 'gsm8k',
    fetch: { kind: 'http-text', urls: ['https://example.org/a.jsonl'] },
  }

  it('sumber otomatis dengan lisensi terbuka diterima', () => {
    expect(sourceSchema.safeParse(base).success).toBe(true)
  })

  it('lisensi berbayar, terbatas, atau belum dicek tidak boleh diambil otomatis', () => {
    for (const license of ['paid', 'restricted', 'unknown']) {
      const r = sourceSchema.safeParse({ ...base, license })
      expect(r.success, license).toBe(false)
    }
  })

  it('PDF resmi hanya dengan lisensi unduhan gratis resmi, dan sebaliknya', () => {
    const pdf = { ...base, license: 'official-free', format: 'pdf', importer: undefined, fetch: { kind: 'official-pdf', files: [{ url: 'https://example.org/a.pdf', title: 'Contoh 2023', grade: 2, year: 2023 }] } }
    expect(sourceSchema.safeParse(pdf).success).toBe(true)
    expect(sourceSchema.safeParse({ ...pdf, license: 'cc-by' }).success).toBe(false)
    expect(sourceSchema.safeParse({ ...base, license: 'official-free' }).success).toBe(false)
  })

  it('alamat harus https dan sumber manual tidak boleh punya fetch', () => {
    expect(sourceSchema.safeParse({ ...base, fetch: { kind: 'http-text', urls: ['http://example.org/a.jsonl'] } }).success).toBe(false)
    expect(sourceSchema.safeParse({ ...base, access: 'manual-upload' }).success).toBe(false)
  })

  it('id sumber kembar ditolak', () => {
    expect(registrySchema.safeParse({ version: 1, updated: '2026-10-13', sources: [base, base] }).success).toBe(false)
  })

  it('hanya lisensi permisif yang boleh masuk repo', () => {
    const only = (id: LicenseId) => sourceSchema.parse({ ...base, license: id })
    expect(canCommitToRepo(only('mit'))).toBe(true)
    expect(canCommitToRepo(only('cc-by'))).toBe(true)
    expect(canCommitToRepo(only('cc-by-sa'))).toBe(false)
    expect(canCommitToRepo(only('cc-by-nc'))).toBe(false)
    expect(LICENSE_POLICY['official-free'].commit).toBe(false)
  })

  it('registri nyata: setiap sumber otomatis lolos kebijakan dan punya host yang jelas', () => {
    const { registry, errors } = loadRegistry(dir)
    expect(errors).toEqual([])
    const auto = registry!.sources.filter(canAutoFetch)
    expect(auto.map((s) => s.id)).toEqual(expect.arrayContaining(['asdiv', 'gsm8k', 'arc-easy', 'openbookqa', 'opentdb']))
    for (const s of auto) {
      if (s.fetch!.kind !== 'local-dir') expect(allowedHosts(s).length, s.id).toBeGreaterThan(0)
      expect(LICENSE_POLICY[s.license].autoFetch, s.id).toBe(true)
    }
    // Paper berbayar tidak pernah otomatis.
    for (const s of registry!.sources.filter((x) => x.license === 'paid')) expect(canAutoFetch(s), s.id).toBe(false)
  })

  it('baris atribusi dan tag sumber', () => {
    const s = sourceSchema.parse(base)
    expect(attributionLine(s)).toBe('Contoh (MIT). Penulis (2020), Contoh.')
    expect(sourceTag('gsm8k')).toBe('src-gsm8k')
  })
})

describe('program olimpiade: expandProgram', () => {
  const math = loadPrograms(dir).programs.find((p) => p.id === 'olimpiade-math-g2')!
  // 2026-10-19 hari Senin.
  const start = '2026-10-19'
  const days = expandProgram(math, start)

  it('mengisi 56 hari berurutan dari tanggal mulai', () => {
    expect(days).toHaveLength(PROGRAM_DAYS)
    expect(days[0]).toMatchObject({ date: start, day: 1, week: 1 })
    expect(days[55]).toMatchObject({ date: '2026-12-13', day: 56, week: 8 })
  })

  it('minggu 1 dan 2 fondasi: Latihan fondasi dan 4 teka-teki di Tes', () => {
    const d1 = days[0]!
    expect(d1.phaseId).toBe('fondasi')
    expect(d1.slots).toEqual([
      { subject: 'math', mode: 'latihan', skillId: 'm2.place-value', questionCount: 10 },
      { subject: 'math', mode: 'tes', skillId: 'm2.oly-number-puzzles', questionCount: 4 },
    ])
    expect(days[13]!.phaseId).toBe('fondasi')
    expect(days[14]!.phaseId).toBe('jenis-soal')
  })

  it('minggu 3 dan 4: satu jenis soal per hari, Tes mengulang soal kemarin', () => {
    const d = days.slice(14, 28)
    expect(d.every((x) => x.phaseId === 'jenis-soal')).toBe(true)
    expect(d[0]!.slots[0]!.skillId).toBe('m2.oly-patterns')
    expect(d[1]!.slots[0]!.skillId).toBe('m2.oly-logic')
    expect(d[1]!.slots[1]!.skillId).toBe('m2.oly-patterns')
    expect(d[0]!.note).toMatch(/rekaman/)
  })

  it('minggu 7 dan 8: Sabtu simulasi, tiga hari terakhir ringan tanpa Tes', () => {
    // Mulai Rabu 21 Okt: Sabtu minggu 8 jatuh sebelum tiga hari terakhir (Minggu sampai Selasa).
    const wed = expandProgram(math, '2026-10-21')
    const sims = wed.filter((x) => x.kind === 'simulation')
    expect(sims.map((x) => x.week)).toEqual([7, 8])
    for (const s of sims) expect(weekday(s.date)).toBe(6)
    const taper = wed.filter((x) => x.kind === 'taper')
    expect(taper.map((x) => x.day)).toEqual([54, 55, 56])
    for (const t of taper) {
      expect(t.slots).toHaveLength(1)
      expect(t.slots[0]).toMatchObject({ mode: 'latihan', questionCount: 4 })
    }
  })

  it('Sabtu yang jatuh di hari ringan tidak menjadi simulasi', () => {
    // Mulai Senin: hari 54 sampai 56 adalah Jumat sampai Minggu, jadi Sabtu minggu 8 adalah hari ringan.
    const sims = days.filter((x) => x.kind === 'simulation')
    expect(sims.map((x) => x.week)).toEqual([7])
    expect(days[54]!.kind).toBe('taper')
    expect(weekday(days[54]!.date)).toBe(6)
  })

  it('programPosition menunjukkan minggu, taper, dan Sabtu simulasi', () => {
    expect(programPosition(math, start, '2026-10-18')).toBeNull()
    expect(programPosition(math, start, '2026-12-14')).toBeNull()
    expect(programPosition(math, start, start)).toMatchObject({ day: 1, week: 1, taper: false, simulationSaturday: false })
    expect(programPosition(math, start, '2026-12-05')).toMatchObject({ week: 7, simulationSaturday: true })
    expect(programPosition(math, start, '2026-12-12')).toMatchObject({ week: 8, taper: true, simulationSaturday: false })
  })

  it('skema menolak fase yang tumpang tindih atau tidak lengkap', () => {
    const bad = { ...math, phases: [{ ...math.phases[0]!, weeks: [1, 3] }, ...math.phases.slice(1)] }
    expect(programSchema.safeParse(bad).success).toBe(false)
    expect(programSchema.safeParse({ ...math, phases: math.phases.slice(1) }).success).toBe(false)
  })
})

describe('batas medali', () => {
  const entries: MedalEntry[] = [
    { competition: 'contoh', year: 2025, grades: [2], unit: 'percent', bands: [{ name: 'Emas', min: 90 }, { name: 'Perak', min: 75 }, { name: 'Perunggu', min: 60 }], source: 'https://example.org/medali', verified: true },
    { competition: 'poin', year: 2025, grades: [], unit: 'points', max: 100, bands: [{ name: 'Emas', min: 80 }], source: 'https://example.org/poin', verified: false },
  ]

  it('mencapai medali dan menunjukkan kekurangan ke medali berikutnya', () => {
    const r = medalFor(entries, { competition: 'contoh', year: 2025, grade: 2, raw: 20, max: 25 })!
    expect(r.reached).toBe('Perak')
    expect(r.next).toEqual({ name: 'Emas', missingPct: 10 })
    expect(medalLine(r)).toBe('Mencapai Perak. Emas kurang 10 persen lagi.')
  })

  it('di bawah semua batas dan di atas batas tertinggi', () => {
    const low = medalFor(entries, { competition: 'contoh', year: 2025, grade: 2, raw: 10, max: 25 })!
    expect(low.reached).toBeNull()
    expect(low.next?.name).toBe('Perunggu')
    expect(medalLine(low)).toBe('Belum mencapai batas medali. Perunggu kurang 20 persen lagi.')
    const top = medalFor(entries, { competition: 'contoh', year: 2025, grade: 2, raw: 25, max: 25 })!
    expect(top.reached).toBe('Emas')
    expect(top.next).toBeNull()
  })

  it('unit poin dihitung terhadap nilai penuh', () => {
    expect(medalFor(entries, { competition: 'poin', year: 2025, grade: 4, raw: 40, max: 50 })!.reached).toBe('Emas')
  })

  it('tanpa data untuk lomba, tahun, atau kelas itu hasilnya null', () => {
    expect(medalFor(entries, { competition: 'lain', year: 2025, grade: 2, raw: 1, max: 2 })).toBeNull()
    expect(medalFor(entries, { competition: 'contoh', year: 2024, grade: 2, raw: 1, max: 2 })).toBeNull()
    expect(medalFor(entries, { competition: 'contoh', year: 2025, grade: 3, raw: 1, max: 2 })).toBeNull()
    expect(medalFor(entries, { competition: 'contoh', year: null, grade: 2, raw: 1, max: 2 })).toBeNull()
  })

  it('berkas medali nyata terbaca', () => {
    expect(loadMedals(dir).errors).toEqual([])
  })
})
