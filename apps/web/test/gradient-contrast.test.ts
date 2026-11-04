import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/** Teks putih di panel gradien harus lolos WCAG AA di setiap titik warna, termasuk titik di antara warna. */
const css = readFileSync(fileURLToPath(new URL('../src/app/globals.css', import.meta.url)), 'utf8')

function stop(name: string): [number, number, number] {
  const m = css.match(new RegExp(`--color-${name}: #([0-9a-f]{6})`))
  if (!m) throw new Error(`token ${name} tidak ada`)
  const hex = m[1]!
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

const onWhite = (rgb: [number, number, number]) => 1.05 / (luminance(rgb) + 0.05)

describe('gradien merek', () => {
  const stops = [stop('hero-start'), stop('hero-mid'), stop('hero-end')]

  it('teks putih minimal 4,5:1 di ketiga titik', () => {
    for (const s of stops) expect(onWhite(s)).toBeGreaterThanOrEqual(4.5)
  })

  it('teks putih minimal 4,5:1 di sepanjang gradien', () => {
    for (let a = 0; a < stops.length - 1; a++) {
      for (let t = 0; t <= 1; t += 0.05) {
        const mix = stops[a]!.map((v, i) => Math.round(v + (stops[a + 1]![i]! - v) * t)) as [number, number, number]
        expect(onWhite(mix)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
