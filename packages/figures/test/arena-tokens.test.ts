/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BG, KNOWLEDGE, KNOWLEDGE_50, MATH, MENTAL, MENTAL_50, WHITE } from '../src/palette'

function channel(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
function lab(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(channel) as [number, number, number]
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}
function deltaE(a: string, b: string): number {
  const p = lab(a)
  const q = lab(b)
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

describe('token arena: kontras WCAG AA', () => {
  it('ungu Quick Maths terbaca di atas putih, kanvas, dan latar tipis (teks 4,5:1)', () => {
    expect(contrast(MENTAL, WHITE)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(MENTAL, BG)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(MENTAL, MENTAL_50)).toBeGreaterThanOrEqual(4.5)
  })
  it('biru Quiz Arena terbaca di atas putih, kanvas, dan latar tipis (teks 4,5:1)', () => {
    expect(contrast(KNOWLEDGE, WHITE)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(KNOWLEDGE, BG)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(KNOWLEDGE, KNOWLEDGE_50)).toBeGreaterThanOrEqual(4.5)
  })
  it('teks putih di atas warna arena terbaca (tombol terisi)', () => {
    expect(contrast(WHITE, MENTAL)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(WHITE, KNOWLEDGE)).toBeGreaterThanOrEqual(4.5)
  })
  it('biru Quiz Arena jelas berbeda dari biru Math dan dari ungu', () => {
    expect(deltaE(KNOWLEDGE, MATH)).toBeGreaterThan(25)
    expect(deltaE(KNOWLEDGE, MENTAL)).toBeGreaterThan(20)
  })
  it('globals.css memakai nilai yang sama dengan palette.ts', () => {
    const css = readFileSync(fileURLToPath(new URL('../../../apps/web/src/app/globals.css', import.meta.url)), 'utf8').toLowerCase()
    for (const [name, hex] of [['mental', MENTAL], ['mental-50', MENTAL_50], ['knowledge', KNOWLEDGE], ['knowledge-50', KNOWLEDGE_50]] as const) {
      expect(css).toContain(`--color-${name}: ${hex.toLowerCase()};`)
    }
  })
})
