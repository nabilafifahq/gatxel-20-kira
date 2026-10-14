import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorldMap, regionIdByLabel } from '@/components/learner/arena/WorldMap'

describe('WorldMap', () => {
  const html = (props: Partial<Parameters<typeof WorldMap>[0]> = {}) => renderToStaticMarkup(createElement(WorldMap, { onPick: () => undefined, disabled: false, feedback: null, ...props }))

  it('dua belas wilayah bisa diketuk, tanpa aset luar dan tanpa warna mentah', () => {
    const out = html()
    expect(out.match(/role="button"/g)).toHaveLength(12)
    for (const label of ['Asia', 'North America', 'Antarctica', 'Pacific Ocean', 'Southern Ocean']) expect(out).toContain(`aria-label="${label}"`)
    expect(out).not.toMatch(/https?:\/\//)
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
    expect(out).not.toMatch(/<image|<script|<style/)
    expect(out).toContain('viewBox="0 0 360 180"')
    expect(out).toContain('tabindex="0"')
  })

  it('selesai dijawab: jawaban benar hijau, pilihan salah merah, dan tidak bisa diketuk lagi', () => {
    const out = html({ disabled: true, feedback: { chosen: 'asia', correct: 'africa' } })
    expect(out).toContain('fill-success')
    expect(out).toContain('fill-danger-50')
    expect(out).toContain('tabindex="-1"')
    expect(out).toContain('aria-disabled="true"')
  })

  it('id wilayah dari nama', () => {
    expect(regionIdByLabel('Indian Ocean')).toBe('indian')
    expect(regionIdByLabel('South America')).toBe('samerica')
    expect(regionIdByLabel('Atlantis')).toBeNull()
    expect(regionIdByLabel(undefined)).toBeNull()
  })
})
