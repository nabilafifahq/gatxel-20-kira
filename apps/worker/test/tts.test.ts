import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadContent } from '@kira/content/load'
import type { Item } from '@kira/content/schema'
import { isClipText, ttsKeyInput } from '@kira/core/tts'
import { generate } from '../src/handlers/tts'
import type { HandlerCtx } from '../src/handlers/types'
import { createTtsClient } from '../src/tts/client'
import { dedupe, itemClips, passageClips, repoClips } from '../src/tts/collect'
import { clipKey, hasClip, writeClip } from '../src/tts/store'

const mcq = (over: Partial<Item> = {}): Item =>
  ({
    id: 'e2.test.001',
    skill: 'e2.test',
    type: 'mcq',
    difficulty: 1,
    prompt: 'Which word fits? The cat is ___ the box.',
    lang: 'en-GB',
    hints: ['a', 'b', 'c'],
    explanation: 'Because.',
    tags: [],
    source: 'kira-original',
    options: [{ text: 'in' }, { text: 'on' }, { text: 'under' }],
    answer: 0,
    ...over,
  }) as Item

describe('klip dari soal', () => {
  it('prompt dan opsi menjadi klip terpisah, ___ dibacakan blank, gaya mengikuti skill', () => {
    const clips = itemClips(mcq())
    expect(clips.map((c) => c.text)).toEqual(['Which word fits? The cat is blank the box.', 'Option A.', 'in', 'Option B.', 'on', 'Option C.', 'under'])
    expect(new Set(clips.map((c) => c.style))).toEqual(new Set(['teacher']))
    expect(itemClips(mcq({ skill: 'e2.spelling-bee' } as Partial<Item>)).every((c) => c.style === 'dictation')).toBe(true)
  })
  it('soal berbahasa Indonesia tidak dibacakan', () => {
    expect(itemClips(mcq({ lang: 'id' } as Partial<Item>))).toEqual([])
  })
  it('langkah pembahasan ikut sebagai klip guru', () => {
    const clips = itemClips(mcq({ solution: [{ say: 'Look at the word before the box.' }, { say: 'It tells us where the cat is.' }] } as Partial<Item>))
    expect(clips.some((c) => c.text === 'Look at the word before the box.')).toBe(true)
  })
  it('klip kembar dibuang', () => {
    const a = itemClips(mcq())
    expect(dedupe([...a, ...a]).length).toBe(a.length)
  })
})

describe('konten repo', () => {
  const { index } = loadContent(join(__dirname, '../../../content'))
  it('mengumpulkan ribuan klip layak baca tanpa kembar setelah dedupe', () => {
    const clips = dedupe(repoClips(index))
    expect(clips.length).toBeGreaterThan(3000)
    expect(clips.every((c) => isClipText(c.text))).toBe(true)
    const keys = new Set(clips.map((c) => ttsKeyInput(c.text, c.style)))
    expect(keys.size).toBe(clips.length)
  })
  it('bacaan cerita memakai pencerita', () => {
    const story = [...index.passages.values()].find((p) => p.kind === 'story' && p.lang === 'en-GB')!
    const clips = passageClips(story)
    expect(clips.length).toBeGreaterThan(0)
    expect(clips.every((c) => c.style === 'narrator')).toBe(true)
  })
})

describe('klien layanan suara', () => {
  const audio = new Uint8Array(400).fill(7)
  it('mengembalikan audio dan header perangkat', async () => {
    const f = vi.fn(async () => new Response(audio, { status: 200, headers: { 'x-kira-device': 'cuda:0', 'x-kira-gen-ms': '1234' } }))
    const r = await createTtsClient('http://tts:8000/', 'x'.repeat(40), f as unknown as typeof fetch).synthesize('Hello there.', 'teacher')
    expect(r.ok && r.device).toBe('cuda:0')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://tts:8000/synthesize')
    const body = JSON.parse(String(init.body)) as { style: string; segments: { kind: string }[]; seed: number; format: string }
    expect(body).toMatchObject({ style: 'teacher', format: 'mp3' })
    expect(Number.isInteger(body.seed)).toBe(true)
    expect(body.segments).toHaveLength(1)
  })
  it('GPU penuh dikenali dari 503', async () => {
    const f = async () => new Response(JSON.stringify({ error: 'gpu_oom', detail: 'penuh' }), { status: 503 })
    const r = await createTtsClient('http://tts:8000', 'x'.repeat(40), f as unknown as typeof fetch).synthesize('Hi.', 'teacher')
    expect(r).toMatchObject({ ok: false, code: 'gpu_oom' })
  })
  it('layanan mati dikenali sebagai tidak terjangkau, tanpa melempar', async () => {
    const f = async () => {
      throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } })
    }
    const c = createTtsClient('http://tts:8000', 'x'.repeat(40), f as unknown as typeof fetch)
    expect(await c.synthesize('Hi.', 'teacher')).toMatchObject({ ok: false, code: 'unavailable' })
    expect(await c.health()).toEqual({ ok: false })
  })
})

describe('simpanan klip dan generate', () => {
  let dir = ''
  afterEach(async () => {
    vi.unstubAllGlobals()
    if (dir) await rm(dir, { recursive: true, force: true })
  })
  const ctx = (dataDir: string): HandlerCtx =>
    ({
      env: { TTS_URL: 'http://tts:8000', KIRA_DATA_DIR: dataDir, KIRA_INTERNAL_TOKEN: 'x'.repeat(40) },
      log: { info() {}, warn() {}, error() {}, child() { return this } },
      signal: new AbortController().signal,
    }) as unknown as HandlerCtx

  it('menulis klip dan mengenalinya', async () => {
    dir = await mkdtemp(join(tmpdir(), 'kira-tts-'))
    const key = clipKey('Hello.', 'teacher')
    expect(await hasClip(dir, key)).toBe(false)
    await writeClip(dir, key, Buffer.from('abc'))
    expect(await hasClip(dir, key)).toBe(true)
    expect((await readFile(join(dir, 'tts', `${key}.mp3`))).toString()).toBe('abc')
  })
  it('hanya membuat klip yang belum ada', async () => {
    dir = await mkdtemp(join(tmpdir(), 'kira-tts-'))
    await writeClip(dir, clipKey('One.', 'teacher'), Buffer.from('x'))
    const f = vi.fn(async () => new Response(new Uint8Array(500).fill(1), { status: 200, headers: { 'x-kira-device': 'cpu', 'x-kira-gen-ms': '10' } }))
    vi.stubGlobal('fetch', f)
    const t = await generate(ctx(dir), [{ text: 'One.', style: 'teacher' }, { text: 'Two.', style: 'teacher' }], { heartbeat: false })
    expect(t).toMatchObject({ total: 2, existing: 1, generated: 1, remaining: 0, stoppedBy: null })
    expect(f).toHaveBeenCalledTimes(1)
    expect(await hasClip(dir, clipKey('Two.', 'teacher'))).toBe(true)
  })
  it('berhenti dengan tenang saat GPU penuh dan melaporkan sisa', async () => {
    dir = await mkdtemp(join(tmpdir(), 'kira-tts-'))
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'gpu_oom' }), { status: 503 }))
    const t = await generate(ctx(dir), [{ text: 'A one.', style: 'teacher' }, { text: 'A two.', style: 'teacher' }], { heartbeat: false })
    expect(t).toMatchObject({ generated: 0, remaining: 2, stoppedBy: 'gpu_oom' })
  })
})
