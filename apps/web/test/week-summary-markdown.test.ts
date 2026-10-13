import { describe, expect, it } from 'vitest'
import { competitionWhen, reportMarkdown, type MarkdownInput } from '@/server/dal/console-report'
import { weekSummary } from '@/dev/fixtures/family'
import type { GateState, SkillWeek } from '@/server/dal/week-summary'

const g = (stars: number, gate: GateState['gate'], accuracy: number | null = null, answers = 12): GateState => ({ gate, stars, accuracy, answers })
const skill = (id: string, subject: SkillWeek['subject'], week: [number, number], before: GateState, after: GateState): SkillWeek => ({ skillId: id, subject, title: id, week: { right: week[0], total: week[1] }, before, after })

const input: MarkdownInput = {
  grade: 2,
  summary: weekSummary,
  streak: 13,
  accuracy: [
    { subject: 'math', points: [{ label: '21 Sep', accuracy: 78 }, { label: '28 Sep', accuracy: null }, { label: '5 Okt', accuracy: 71 }, { label: '12 Okt', accuracy: 68 }] },
    { subject: 'english', points: [{ label: '21 Sep', accuracy: 82 }, { label: '28 Sep', accuracy: 85 }, { label: '5 Okt', accuracy: 84 }, { label: '12 Okt', accuracy: 88 }] },
    { subject: 'science', points: [{ label: '21 Sep', accuracy: null }, { label: '28 Sep', accuracy: null }, { label: '5 Okt', accuracy: null }, { label: '12 Okt', accuracy: null }] },
  ],
  up: [skill('e2.magic-e', 'english', [5, 5], g(2, 'review'), g(3, 'mastered')), skill('m2.numbers-to-100', 'math', [9, 10], g(3, 'mastered'), g(3, 'mastered'))],
  repeat: [{ ...skill('m2.arrays', 'math', [2, 6], g(2, 'review'), g(2, 'review')), note: '2 dari 6 benar minggu ini' }],
  competitions: [
    { name: 'KMNR', when: competitionWhen('2026-11-22', true), close: '2026-11-01', status: 'not-registered' },
    { name: 'ESMO 4, final', when: competitionWhen(null, true), close: null, status: 'registered' },
  ],
  limits: { screenLimitMin: 60, restWeekdays: [0], reviewEnabled: true },
}

describe('reportMarkdown', () => {
  const md = reportMarkdown(input)

  it('memakai nama samaran dan tidak memuat nama asli', () => {
    expect(md.startsWith('# Ringkasan minggu learner_1\n')).toBe(true)
    expect(md).not.toContain('Alya')
  })

  it('memuat waktu, quest, streak, dan tabel akurasi 4 minggu', () => {
    expect(md).toContain('- Belajar 4 jam 5 menit dalam 6 hari, rata-rata 41 menit sehari.')
    expect(md).toContain('- Sesi wajib selesai 17 dari 18.')
    expect(md).toContain('- Streak sekarang 13 hari.')
    expect(md).toContain('| Mapel | 21 Sep | 28 Sep | 5 Okt | 12 Okt |')
    expect(md).toContain('| Math | 78% | belum ada | 71% | 68% |')
  })

  it('menyebut skill dengan id, kenaikan bintang, dan catatan perlu diulang', () => {
    expect(md).toContain('(m2.arrays), Math: 2 dari 6 benar minggu ini')
    expect(md).toContain('(e2.magic-e), English: 2 ke 3 bintang')
    expect(md).toContain('(m2.numbers-to-100), Math: tetap 3 bintang, 9 dari 10 benar minggu ini')
  })

  it('lomba dan batas ditulis dalam bahasa Indonesia tanpa en dash atau em dash', () => {
    expect(md).toContain('- KMNR: perkiraan November 2026, pendaftaran tutup 1 November 2026, belum daftar')
    expect(md).toContain('- ESMO 4, final: tanggal belum diumumkan, sudah terdaftar')
    expect(md).toContain('- Waktu layar paling lama 60 menit sehari, hari istirahat Minggu.')
    expect(md).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
  })

  it('daftar kosong diberi kalimat penjelas', () => {
    const empty = reportMarkdown({ ...input, up: [], repeat: [], competitions: [] })
    expect(empty).toContain('- Tidak ada skill yang perlu diulang minggu ini.')
    expect(empty).toContain('- Belum ada skill yang naik bintang minggu ini.')
    expect(empty).toContain('- Belum ada lomba yang dicatat untuk learner ini.')
  })
})
