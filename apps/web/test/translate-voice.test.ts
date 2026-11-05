import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readExplainChoice } from '@/components/learner/explain-lang'
import { planForLang } from '@/components/learner/tts-client'

describe('suara mengikuti bahasa teks', () => {
  it('teks Indonesia selalu peran indonesian', () => {
    expect(planForLang('Tambahkan 2 dan 3.', 'id', 'teacher')).toEqual([{ text: 'Tambahkan 2 dan 3.', style: 'indonesian' }])
    expect(planForLang([{ text: 'Kalimat.', style: 'second' }], 'id', 'teacher')).toEqual([{ text: 'Kalimat.', style: 'indonesian' }])
  })

  it('teks Inggris tidak pernah peran indonesian', () => {
    expect(planForLang('Add 2 and 3.', 'en-GB', 'indonesian')).toEqual([{ text: 'Add 2 and 3.', style: 'teacher' }])
    expect(planForLang([{ text: 'Add.', style: 'indonesian' }], 'en-GB', 'teacher')).toEqual([{ text: 'Add.', style: 'teacher' }])
    expect(planForLang('Add 2 and 3.', 'en-GB', 'quizhost')).toEqual([{ text: 'Add 2 and 3.', style: 'quizhost' }])
  })

  it('layar anak tidak memakai suara perangkat', () => {
    const files = (d: string): string[] =>
      readdirSync(d).flatMap((f) => {
        const p = join(d, f)
        return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : []
      })
    const root = join(__dirname, '../src')
    const hits = [...files(join(root, 'components/learner')), ...files(join(root, 'screens/learner')), ...files(join(root, 'components/widgets'))].filter((p) =>
      /\bspeechSynthesis\.|SpeechSynthesisUtterance/.test(readFileSync(p, 'utf8')),
    )
    expect(hits).toEqual([])
  })
})

describe('pilihan bahasa penjelasan per anak', () => {
  it('bawaan mengikuti setelan orang tua', () => {
    expect(readExplainChoice(null, false)).toBe(false)
    expect(readExplainChoice(null, true)).toBe(true)
  })

  it('pilihan anak diingat selama setelan orang tua sama', () => {
    expect(readExplainChoice(JSON.stringify({ on: true, base: false }), false)).toBe(true)
    expect(readExplainChoice(JSON.stringify({ on: false, base: true }), true)).toBe(false)
  })

  it('setelan orang tua yang berubah mengalahkan pilihan lama', () => {
    expect(readExplainChoice(JSON.stringify({ on: false, base: false }), true)).toBe(true)
  })

  it('isi rusak kembali ke setelan orang tua', () => {
    expect(readExplainChoice('{rusak', true)).toBe(true)
    expect(readExplainChoice('{"on":"ya","base":false}', false)).toBe(false)
  })
})
