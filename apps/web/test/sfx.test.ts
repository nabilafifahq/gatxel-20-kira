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
    expect(sfx.SFX_NAMES).toEqual(['correct', 'notyet', 'tap', 'combo', 'levelup', 'badge', 'chest', 'complete', 'tick', 'timeup', 'count', 'go', 'whoosh', 'flag', 'quiz'])
  })

  it('varian dipilih acak dan tidak pernah sama dua kali berturut-turut', async () => {
    const { pickVariant } = await import('@/components/learner/sfx')
    for (let last = 0; last < 4; last++) {
      for (let i = 0; i < 50; i++) expect(pickVariant(4, last, () => i / 50)).not.toBe(last)
    }
    expect(pickVariant(1, 0)).toBe(0)
    const seen = new Set<number>()
    for (let i = 0; i < 100; i++) seen.add(pickVariant(3, 1, () => i / 100))
    expect([...seen].sort()).toEqual([0, 2])
  })

  it('kunci berkas mengikuti tingkat kombo dan bintang', async () => {
    const { sfxKey } = await import('@/components/learner/sfx')
    expect(sfxKey('combo', { level: 2 })).toBe('combo2')
    expect(sfxKey('combo')).toBe('combo1')
    expect(sfxKey('complete', { stars: 3 })).toBe('big')
    expect(sfxKey('complete', { stars: 1 })).toBe('complete')
    expect(sfxKey('tap')).toBe('tap')
  })

  it('pilihan tutor mengalahkan pilihan perangkat', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const sfx = await import('@/components/learner/sfx')
    expect(sfx.isSfxMuted()).toBe(false)
    sfx.setTutorSoundPolicy({ sfx: false, music: false })
    expect(sfx.isSfxMuted()).toBe(true)
    expect(sfx.isSfxDeviceMuted()).toBe(false)
    expect(sfx.tutorAllowsMusic()).toBe(false)
    sfx.setTutorSoundPolicy({ sfx: true, music: true })
    expect(sfx.isSfxMuted()).toBe(false)
  })

  it('musik bawaan mati dan mengikuti izin tutor', async () => {
    const store = fakeStorage()
    vi.stubGlobal('localStorage', store)
    const sfx = await import('@/components/learner/sfx')
    const music = await import('@/components/learner/music')
    expect(music.isMusicDeviceOn()).toBe(false)
    expect(music.isMusicWanted()).toBe(false)
    music.setMusicOn(true)
    expect(store.getItem(music.MUSIC_ON_KEY)).toBe('1')
    expect(music.isMusicWanted()).toBe(true)
    sfx.setTutorSoundPolicy({ sfx: true, music: false })
    expect(music.isMusicWanted()).toBe(false)
  })

  it('musik turun selama ada pembaca dan naik lagi setelah semua selesai', async () => {
    const music = await import('@/components/learner/music')
    expect(music.isMusicDucked()).toBe(false)
    music.duckMusic('a', true)
    music.duckMusic('b', true)
    music.duckMusic('a', false)
    expect(music.isMusicDucked()).toBe(true)
    music.duckMusic('b', false)
    expect(music.isMusicDucked()).toBe(false)
  })
})