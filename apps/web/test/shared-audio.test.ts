import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

/** Ketukan pertama membuka elemen audio bersama. touchend sesudah menggulir tidak boleh menghabiskan kesempatan itu. */
type Listener = (e: Event) => void

async function load() {
  vi.resetModules()
  const listeners = new Map<string, Listener>()
  const audio = { paused: true, removeAttribute: vi.fn(), load: vi.fn() }
  vi.stubGlobal('window', {
    addEventListener: (t: string, f: Listener) => void listeners.set(t, f),
    removeEventListener: (t: string) => void listeners.delete(t),
  })
  vi.stubGlobal(
    'Audio',
    class {
      constructor() {
        return audio
      }
    },
  )
  await import('@/components/learner/shared-audio')
  return { listeners, audio }
}

describe('ketukan pertama', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('touchend sesudah menggulir tidak melepas pendengar, click melepasnya', async () => {
    const { listeners, audio } = await load()
    listeners.get('touchend')!({ type: 'touchend' } as Event)
    expect(listeners.has('click')).toBe(true)
    expect(listeners.has('touchend')).toBe(true)
    expect(audio.load).toHaveBeenCalledTimes(1)
    listeners.get('click')!({ type: 'click' } as Event)
    expect(audio.load).toHaveBeenCalledTimes(2)
    expect(listeners.size).toBe(0)
  })

  it('pendengar terpasang dari layout learner, bukan dari layar yang memakai suara', () => {
    expect(readFileSync(join(__dirname, '../src/components/learner/SoundRuntime.tsx'), 'utf8')).toContain("import './shared-audio'")
  })

  it('klip yang sedang berbunyi tidak diganggu', async () => {
    const { listeners, audio } = await load()
    audio.paused = false
    listeners.get('click')!({ type: 'click' } as Event)
    expect(audio.load).not.toHaveBeenCalled()
  })
})
