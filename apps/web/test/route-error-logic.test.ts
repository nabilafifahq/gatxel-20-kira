import { describe, expect, it } from 'vitest'
import { isChunkError, mayAutoReload } from '../src/components/runtime/route-error-logic'

describe('penjaga galat rute', () => {
  it('mengenali chunk yang hilang di Chromium, Safari, dan WebView', () => {
    expect(isChunkError({ name: 'ChunkLoadError', message: 'Loading chunk 123 failed.' })).toBe(true)
    expect(isChunkError({ message: 'Loading CSS chunk 9 failed' })).toBe(true)
    expect(isChunkError({ message: 'Failed to load chunk /_next/static/chunks/a.js' })).toBe(true)
    expect(isChunkError({ message: 'Failed to fetch dynamically imported module: https://x/y.js' })).toBe(true)
    expect(isChunkError({ message: 'Importing a module script failed.' })).toBe(true)
  })

  it('galat biasa bukan galat chunk', () => {
    expect(isChunkError({ name: 'TypeError', message: "Cannot read properties of undefined (reading 'x')" })).toBe(false)
    expect(isChunkError(null)).toBe(false)
  })

  it('muat ulang otomatis hanya sekali per menit, jadi tidak pernah berputar', () => {
    expect(mayAutoReload(null, 1000)).toBe(true)
    expect(mayAutoReload(1000, 30_000)).toBe(false)
    expect(mayAutoReload(1000, 62_000)).toBe(true)
  })
})
