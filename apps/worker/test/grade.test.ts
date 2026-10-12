import { describe, expect, it } from 'vitest'
import { JobError } from '../src/errors'
import { cleanFeedback, redactName, validateGrade } from '../src/handlers/grade'

describe('redactName', () => {
  it('nama lengkap dan nama depan diganti [name], kata lain tetap', () => {
    expect(redactName('My name is Aisha Putri. Aisha likes rice.', 'Aisha Putri')).toBe('My name is [name]. [name] likes rice.')
    expect(redactName('Raisha and aisha', 'Aisha')).toBe('Raisha and [name]')
  })

  it('nama pendek di bawah 3 huruf tidak diganti supaya kata lain aman', () => {
    expect(redactName('I am at home', 'Al')).toBe('I am at home')
  })
})

describe('cleanFeedback', () => {
  it('em dash dan en dash diganti koma, paling banyak 2 kalimat', () => {
    const dash = String.fromCharCode(0x2014)
    const en = String.fromCharCode(0x2013)
    expect(cleanFeedback(`You used capital letters well ${dash} great job! Next, add a full stop. Also check spelling.`)).toBe(
      'You used capital letters well, great job! Next, add a full stop.',
    )
    expect(cleanFeedback(`Nice ${en} clear writing.`)).toBe('Nice, clear writing.')
  })

  it('dipotong di 300 karakter', () => {
    const long = `${'word '.repeat(100)}end.`
    expect(cleanFeedback(long).length).toBeLessThanOrEqual(301)
  })
})

describe('validateGrade', () => {
  const criteria = [{ points: 1 }, { points: 2 }]
  const now = new Date('2026-10-12T10:00:00Z')

  it('skor bulat dalam batas poin', () => {
    expect(validateGrade({ scores: [1, 2], feedback: 'You named the food. Next, say why you like it.', confidence: 'tinggi' }, criteria, now)).toEqual({
      scores: [1, 2],
      feedback: 'You named the food. Next, say why you like it.',
      confidence: 'tinggi',
      createdAt: '2026-10-12T10:00:00.000Z',
    })
  })

  it('jumlah skor salah, skor di luar batas, atau isian hilang ditolak (dicoba lagi)', () => {
    for (const bad of [
      { scores: [1], feedback: 'x', confidence: 'sedang' },
      { scores: [1, 3], feedback: 'x', confidence: 'sedang' },
      { scores: [-1, 0], feedback: 'x', confidence: 'sedang' },
      { scores: [1, 1.5], feedback: 'x', confidence: 'sedang' },
      { scores: [1, 1], feedback: 'x', confidence: 'high' },
      { scores: [1, 1], confidence: 'rendah' },
    ]) {
      const e = (() => {
        try {
          validateGrade(bad, criteria, now)
        } catch (err) {
          return err
        }
      })()
      expect(e).toBeInstanceOf(JobError)
      expect((e as JobError).retryable).toBe(true)
    }
  })
})
