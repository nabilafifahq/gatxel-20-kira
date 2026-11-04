import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BookCover, COVER_MOTIFS, COVER_TINTS } from '../src'
import { PALETTE } from '../src/palette'

const allowed = new Set(PALETTE.map((c) => c.toUpperCase()))

describe('sampul buku', () => {
  it('menggambar setiap gambar dan nada tanpa warna di luar palet', () => {
    for (const motif of COVER_MOTIFS) {
      for (const tint of COVER_TINTS) {
        const html = renderToStaticMarkup(<BookCover motif={motif} tint={tint} />)
        expect(html).toContain('<svg')
        expect(html).toContain('aria-hidden')
        for (const m of html.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) expect(allowed.has(m[0].toUpperCase())).toBe(true)
      }
    }
  })

  it('judul menjadi label untuk pembaca layar', () => {
    const html = renderToStaticMarkup(<BookCover motif="kite" tint="math" title="Cover of A Book" />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Cover of A Book"')
  })
})
