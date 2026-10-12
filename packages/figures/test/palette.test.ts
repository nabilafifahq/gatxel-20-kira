/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PALETTE } from '../src/palette'

const SRC = fileURLToPath(new URL('../src', import.meta.url))

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

const allowed = new Set(PALETTE.map((c) => c.toUpperCase()))

describe('palet figur', () => {
  const sources = files(SRC).filter((f) => /\.(ts|tsx|css|svg|json)$/.test(f))

  it('menemukan berkas sumber untuk diperiksa', () => {
    expect(sources.length).toBeGreaterThan(5)
  })

  it('setiap warna hex di src ada di PALETTE', () => {
    const offenders: string[] = []
    for (const f of sources) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        const hex = m[0].toUpperCase()
        if (!allowed.has(hex)) {
          const line = text.slice(0, m.index).split('\n').length
          offenders.push(`${relative(SRC, f)}:${line} ${m[0]}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('tidak ada warna dari rgb(), hsl(), atau nama warna CSS di fill dan stroke', () => {
    const offenders: string[] = []
    const named = /\b(?:fill|stroke|stopColor|color)\s*[:=]\s*["'](?!none\b|transparent\b|currentColor\b|url\()([a-zA-Z]+)["']/g
    for (const f of sources) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(/\b(?:rgba?|hsla?)\(/g)) offenders.push(`${relative(SRC, f)} ${m[0]}`)
      for (const m of text.matchAll(named)) offenders.push(`${relative(SRC, f)} ${m[0]}`)
    }
    expect(offenders).toEqual([])
  })
})
