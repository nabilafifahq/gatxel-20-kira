import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Avatar, PlanetArt } from '../src'
import { AVATARS } from '../src/spec'
import { ACCESSORY_ART_IDS } from '../src/icons/accessories'
import { PLANET_ART_NAMES } from '../src/icons/planets'

describe('aksesori avatar dan planet', () => {
  it('setiap aksesori menambah gambar di atas setiap avatar', () => {
    for (const name of AVATARS) {
      const plain = renderToStaticMarkup(<Avatar name={name} size={64} />)
      for (const acc of ACCESSORY_ART_IDS) {
        const dressed = renderToStaticMarkup(<Avatar name={name} accessory={acc} size={64} />)
        expect(dressed.length, `${name} ${acc}`).toBeGreaterThan(plain.length + 40)
        expect(dressed.startsWith(plain.slice(0, plain.length - '</svg>'.length))).toBe(true)
      }
    }
  })

  it('id aksesori yang tidak dikenal diabaikan, bukan merusak avatar', () => {
    const plain = renderToStaticMarkup(<Avatar name="fox" size={64} />)
    expect(renderToStaticMarkup(<Avatar name="fox" accessory="tidak-ada" size={64} />)).toBe(plain)
    expect(renderToStaticMarkup(<Avatar name="fox" accessory={null} size={64} />)).toBe(plain)
  })

  it('sepuluh benda langit punya gambar dan semuanya memakai warna palet', () => {
    expect(PLANET_ART_NAMES).toHaveLength(10)
    for (const name of PLANET_ART_NAMES) {
      const svg = renderToStaticMarkup(<PlanetArt name={name} size={48} title={name} />)
      expect(svg).toContain('<svg')
      expect(svg).toContain(`aria-label="${name}"`)
    }
  })
})
