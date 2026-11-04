import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const script = resolve(__dirname, '../../../scripts/audit-duplicates.mjs')

function run(items: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), 'kira-dup-'))
  mkdirSync(join(dir, 'items', 'x'), { recursive: true })
  writeFileSync(join(dir, 'items', 'x', 'a.json'), JSON.stringify({ skill: 'e1.a', items }))
  return spawnSync(process.execPath, [script], { env: { ...process.env, KIRA_CONTENT_DIR: dir }, encoding: 'utf8' })
}

const mcq = (id: string, prompt: string, texts: string[], answer: number) => ({
  id, skill: 'e1.a', type: 'mcq', difficulty: 1, prompt, options: texts.map((text, i) => (i === answer ? { text } : { text, why: 'no' })), answer,
})

describe('audit-duplicates', () => {
  it('lolos bila semua soal berbeda', () => {
    expect(run([mcq('e1.a.001', 'Which is a fruit?', ['mango', 'chair'], 0), mcq('e1.a.002', 'Which is a vegetable?', ['carrot', 'apple'], 0)]).status).toBe(0)
  })
  it('gagal untuk soal sama yang hanya beda huruf besar, tanda baca, atau kata sandang', () => {
    expect(run([mcq('e1.a.001', 'Which is a fruit?', ['mango', 'chair'], 0), mcq('e1.a.002', 'which is the fruit', ['chair', 'Mango.'], 1)]).status).toBe(1)
  })
  it('gagal untuk prompt dan jawaban benar sama yang hanya beda pengecoh', () => {
    expect(run([mcq('e1.a.001', 'Which is a fruit?', ['mango', 'chair'], 0), mcq('e1.a.002', 'Which is a fruit?', ['mango', 'shoe'], 0)]).status).toBe(1)
  })
  it('beda angka tetap soal berbeda', () => {
    expect(run([mcq('e1.a.001', 'What is 3 + 4?', ['7', '8'], 0), mcq('e1.a.002', 'What is 3 + 5?', ['8', '7'], 0)]).status).toBe(0)
  })
})
