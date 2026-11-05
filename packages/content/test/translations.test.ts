import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { presentItem } from '../src/present'
import type { Item } from '../src/schema'
import { loadTranslations, lookupTranslation, translationHash, translationReport } from '../src/translations'
import { translateSolution } from '../src/walkthrough'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function content(lesson: string[], entries: Record<string, { en: string; id: string }>): string {
  const dir = mkdtempSync(join(tmpdir(), 'kira-terjemah-'))
  dirs.push(dir)
  mkdirSync(join(dir, 'lessons/math/g1'), { recursive: true })
  mkdirSync(join(dir, 'translations/id/math/g1'), { recursive: true })
  writeFileSync(join(dir, 'lessons/math/g1/add.json'), JSON.stringify({ skill: 'm1.add', title: 'Add', steps: lesson.map((say) => ({ say })) }))
  writeFileSync(join(dir, 'translations/id/math/g1/add.json'), JSON.stringify({ entries }))
  return dir
}

const entry = (en: string, id: string) => ({ [translationHash(en)]: { en, id } })

describe('penyimpanan terjemahan', () => {
  it('menemukan teks yang persis, dan teks yang berubah kembali ke bahasa Inggris', () => {
    const dir = content(['Add 2 and 3.'], entry('Add 2 and 3.', 'Tambahkan 2 dan 3.'))
    const { map, problems } = loadTranslations(dir)
    expect(problems).toEqual([])
    expect(lookupTranslation(map, 'Add 2 and 3.')).toBe('Tambahkan 2 dan 3.')
    expect(lookupTranslation(map, 'Add 2 and 4.')).toBeNull()
    expect(lookupTranslation(map, 'Add 2  and 3.')).toBeNull()
    expect(lookupTranslation(map, null)).toBeNull()
  })

  it('entri yang hash-nya tidak cocok tidak dimuat dan dilaporkan', () => {
    const dir = content(['Add 2 and 3.'], { deadbeef: { en: 'Add 2 and 3.', id: 'Salah pasangan.' } })
    const { map, problems } = loadTranslations(dir)
    expect(map.size).toBe(0)
    expect(problems).toHaveLength(1)
  })

  it('laporan mencatat cakupan dan terjemahan usang', () => {
    const dir = content(['Add 2 and 3.', 'Count on.'], { ...entry('Add 2 and 3.', 'Tambahkan 2 dan 3.'), ...entry('Old text.', 'Teks lama.') })
    const r = translationReport(dir)
    expect(r.coverage.find((c) => c.kind === 'lesson')).toEqual({ kind: 'lesson', total: 2, translated: 1 })
    expect(r.stale.map((s) => s.en)).toEqual(['Old text.'])
  })
})

const item = {
  id: 'm1.add.001',
  skill: 'm1.add',
  type: 'mcq',
  difficulty: 1,
  prompt: 'What is 2 + 3?',
  hints: [],
  tags: [],
  explanation: '2 + 3 = 5. Count on from 2.',
  options: [{ text: '4', why: 'That is one too few.' }, { text: '5' }],
  answer: 1,
} as unknown as Item

const lookup = (en: string): string | null =>
  ({
    '2 + 3 = 5. Count on from 2.': '2 + 3 = 5. Hitung maju dari 2.',
    'That is one too few.': 'Itu kurang satu.',
    'Read what the question asks.': 'Baca apa yang ditanyakan soal.',
  })[en] ?? null

describe('terjemahan pada soal', () => {
  it('tidak terkirim tanpa kunci, termasuk di mode berwaktu', () => {
    const shown = presentItem(item, { seed: 's', includeKey: false, includeHints: false, translate: lookup })
    expect(shown.reveal).toBeUndefined()
    expect(JSON.stringify(shown)).not.toContain('Hitung maju')
  })

  it('ikut bersama kunci', () => {
    const shown = presentItem(item, { seed: 's', includeKey: true, includeHints: false, translate: lookup })
    expect(shown.reveal?.explanationId).toBe('2 + 3 = 5. Hitung maju dari 2.')
    expect(shown.reveal?.explanation).toBe('2 + 3 = 5. Count on from 2.')
    expect(shown.reveal?.whyWrongId).toEqual(['Itu kurang satu.', null])
  })

  it('teks tanpa terjemahan tidak punya kolom Indonesia', () => {
    const shown = presentItem(item, { seed: 's', includeKey: true, includeHints: false, translate: () => null })
    expect(shown.reveal?.explanationId).toBeUndefined()
  })
})

describe('terjemahan langkah pembahasan', () => {
  it('langkah turunan dicocokkan per kalimat', () => {
    const steps = translateSolution(item, [{ say: 'Read what the question asks.' }, { say: '2 + 3 = 5.' }, { say: 'Count on from 2.' }, { say: 'Not 4. That is one too few.' }, { say: 'So the answer is:', show: '5' }], lookup)
    expect(steps.map((s) => s.sayId)).toEqual(['Baca apa yang ditanyakan soal.', '2 + 3 = 5.', 'Hitung maju dari 2.', 'Bukan 4. Itu kurang satu.', undefined])
    expect(steps[4]!.say).toBe('So the answer is:')
  })

  it('jumlah kalimat beda: tidak dipasangkan, tetap bahasa Inggris', () => {
    const steps = translateSolution(item, [{ say: 'Count on from 2.' }], (en) => (en === item.explanation ? 'Satu kalimat saja.' : null))
    expect(steps[0]!.sayId).toBeUndefined()
  })
})
