import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

describe('suara learner', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('aktif secara default dan pilihan bisu disimpan per perangkat', async () => {
    const store = fakeStorage()
    vi.stubGlobal('localStorage', store)
    const sfx = await import('@/components/learner/sfx')
    expect(sfx.isSfxMuted()).toBe(false)
    sfx.setSfxMuted(true)
    expect(sfx.isSfxMuted()).toBe(true)
    expect(store.getItem(sfx.SFX_MUTED_KEY)).toBe('1')
    sfx.setSfxMuted(false)
    expect(store.getItem(sfx.SFX_MUTED_KEY)).toBeNull()
  })

  it('membaca pilihan bisu yang sudah tersimpan', async () => {
    const store = fakeStorage()
    store.setItem('kira.sfx.muted', '1')
    vi.stubGlobal('localStorage', store)
    const sfx = await import('@/components/learner/sfx')
    expect(sfx.isSfxMuted()).toBe(true)
  })

  it('tetap jalan saat penyimpanan diblokir', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    })
    const sfx = await import('@/components/learner/sfx')
    expect(sfx.isSfxMuted()).toBe(false)
    sfx.setSfxMuted(true)
    expect(sfx.isSfxMuted()).toBe(true)
  })

  it('memberi tahu pendengar saat pilihan berubah', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const sfx = await import('@/components/learner/sfx')
    const seen: boolean[] = []
    const off = sfx.subscribeSfxMuted(() => seen.push(sfx.isSfxMuted()))
    sfx.setSfxMuted(true)
    sfx.setSfxMuted(false)
    off()
    sfx.setSfxMuted(true)
    expect(seen).toEqual([true, false])
  })

  it('playSfx dan primeSfx tidak melempar galat di server', async () => {
    const sfx = await import('@/components/learner/sfx')
    expect(() => sfx.playSfx('correct')).not.toThrow()
    expect(() => sfx.primeSfx()).not.toThrow()
    expect(sfx.SFX_NAMES).toEqual(['correct', 'notyet', 'combo', 'levelup', 'badge', 'complete', 'tick', 'timeup', 'tap'])
  })
})
