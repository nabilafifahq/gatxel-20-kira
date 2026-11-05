import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { showSizeClass } from '@/components/learner/LessonShow'

describe('ukuran huruf papan pelajaran', () => {
  it('teks pendek tetap besar', () => {
    expect(showSizeClass('3 + 4 = 7')).toBe('text-h1 md:py-4 md:text-display')
  })

  it('kasus pemilik memakai ukuran terkecil supaya muat di lebar iPhone', () => {
    expect(showSizeClass('disagree, disobey, dishonest')).toBe('text-h3 md:text-h2')
  })

  it('pemutar langkah tidak memakai ukuran display di tablet', () => {
    expect(showSizeClass('3 + 4 = 7', 'player')).toBe('text-h1')
    expect(showSizeClass('un + happy = unhappy', 'player')).toBe('text-h2 md:text-h1')
  })

  it('setiap teks show di pelajaran mendapat kelas yang dikenal', () => {
    const root = join(__dirname, '..', '..', '..', 'content', 'lessons')
    const texts: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else for (const s of (JSON.parse(readFileSync(p, 'utf8')) as { steps: { show?: string }[] }).steps) if (s.show) texts.push(s.show)
      }
    }
    walk(root)
    expect(texts.length).toBeGreaterThan(1000)
    for (const t of texts) expect(showSizeClass(t)).toMatch(/^text-(h1|h2|h3)( md:py-4)? md:text-(display|h1|h2)$/)
  })
})
