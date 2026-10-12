import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Avatar, Icon } from '../src/icons'
import { AVATAR_GLYPHS } from '../src/icons/avatars'
import { ICON_GLYPHS } from '../src/icons/glyphs'
import { DIVIDER, INK, PALETTE, WHITE } from '../src/palette'
import { AVATARS, ICON_NAMES, PIN_PICTURES } from '../src/spec'

const markup = (child: ReactElement, box = 48): string =>
  renderToStaticMarkup(<svg viewBox={`0 0 ${box} ${box}`}>{child}</svg>)

/** Lingkaran abu-abu polos yang dulu menggantikan semua ikon. */
const PLACEHOLDER = markup(<circle cx="24" cy="24" r="18" fill={DIVIDER} stroke={INK} strokeWidth="2.5" />)

const ALLOWED = new Set<string>([...PALETTE.map((c) => c.toLowerCase()), 'none'])

function colours(svg: string): string[] {
  return [...svg.matchAll(/\b(?:fill|stroke)="([^"]*)"/g)].map((m) => (m[1] ?? '').toLowerCase())
}

function shapeCount(svg: string): number {
  return (svg.match(/<(?:path|circle|ellipse|rect|polygon|polyline|line)\b/g) ?? []).length
}

const iconMarkup = new Map(ICON_NAMES.map((n) => [n, markup(ICON_GLYPHS[n])]))
const avatarMarkup = new Map(AVATARS.map((n) => [n, markup(AVATAR_GLYPHS[n], 64)]))

describe('ikon', () => {
  it('setiap nama di ICON_NAMES punya gambar, tanpa nama lebih', () => {
    expect(Object.keys(ICON_GLYPHS).sort()).toEqual([...ICON_NAMES].sort())
  })

  it.each(ICON_NAMES)('%s digambar dan bukan lingkaran pengganti', (name) => {
    const svg = iconMarkup.get(name) ?? ''
    expect(shapeCount(svg)).toBeGreaterThan(0)
    expect(svg).not.toBe(PLACEHOLDER)
  })

  it.each(ICON_NAMES)('%s hanya memakai warna palet dan bergaris tinta', (name) => {
    const svg = iconMarkup.get(name) ?? ''
    for (const c of colours(svg)) expect(ALLOWED, `${name}: ${c}`).toContain(c)
    expect(svg).toContain(`stroke="${INK}"`)
  })

  it.each(ICON_NAMES)('%s tanpa teks, gradien, filter, gambar luar, atau id', (name) => {
    const svg = iconMarkup.get(name) ?? ''
    expect(svg).not.toMatch(/<text|Gradient|<filter|<image|<use|<clipPath|<mask|\sid="/)
  })

  it('tidak ada dua ikon yang gambarnya sama', () => {
    expect(new Set(iconMarkup.values()).size).toBe(ICON_NAMES.length)
  })

  it('setiap gambar PIN berwarna, bukan hanya tinta dan putih', () => {
    for (const name of PIN_PICTURES) {
      const fills = colours(iconMarkup.get(name) ?? '').filter((c) => c !== 'none' && c !== INK.toLowerCase() && c !== WHITE.toLowerCase())
      expect(fills.length, name).toBeGreaterThan(0)
    }
  })
})

describe('avatar', () => {
  it.each(AVATARS)('%s punya lencana putih bergaris tinta dan wajah', (name) => {
    const svg = avatarMarkup.get(name) ?? ''
    expect(svg).toContain(`<circle cx="32" cy="32" r="31" fill="${WHITE}" stroke="${INK}" stroke-width="2"></circle>`)
    expect(shapeCount(svg)).toBeGreaterThan(5)
    for (const c of colours(svg)) expect(ALLOWED, `${name}: ${c}`).toContain(c)
    expect(svg).not.toMatch(/<text|Gradient|<filter|<image|<use|\sid="/)
  })

  it('kedelapan avatar berbeda satu sama lain', () => {
    expect(new Set(avatarMarkup.values()).size).toBe(AVATARS.length)
  })
})

describe('komponen Icon dan Avatar', () => {
  it('tersembunyi dari pembaca layar tanpa judul', () => {
    const svg = renderToStaticMarkup(<Icon name="apple" size={24} />)
    expect(svg).toContain('aria-hidden="true"')
    expect(svg).toContain('width="24"')
    expect(svg).toContain('viewBox="0 0 48 48"')
  })

  it('memakai role img dan label bila diberi judul', () => {
    const icon = renderToStaticMarkup(<Icon name="cat" title="Cat" />)
    expect(icon).toContain('role="img"')
    expect(icon).toContain('aria-label="Cat"')
    const avatar = renderToStaticMarkup(<Avatar name="owl" size={96} title="Owl" />)
    expect(avatar).toContain('viewBox="0 0 64 64"')
    expect(avatar).toContain('aria-label="Owl"')
  })
})
