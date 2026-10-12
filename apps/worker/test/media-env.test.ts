import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { extractJson } from '../src/ai/json'
import { EnvError, loadEnv } from '../src/env'
import { deleteStored, readStored, safeMediaPath, storeFile } from '../src/media'

const ORG = '5b1c2d3e-4f50-4a61-8b72-9c83d4e5f601'

describe('media', () => {
  let dir = ''
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('path keluar dari folder media ditolak', () => {
    expect(() => safeMediaPath('/data', '../etc/passwd')).toThrow('Path media tidak valid')
    expect(() => safeMediaPath('/data', `${ORG}/../../x`)).toThrow('Path media tidak valid')
    expect(() => safeMediaPath('/data', '/etc/passwd')).toThrow('Path media tidak valid')
    expect(() => safeMediaPath('/data', 'a\0b')).toThrow('Path media tidak valid')
    expect(() => safeMediaPath('/data', '')).toThrow('Path media tidak valid')
    expect(safeMediaPath('/data', `${ORG}/2026-10/a.png`)).toBe(`/data/media/${ORG}/2026-10/a.png`)
  })

  it('storeFile memakai tata letak web dan izin 0600', async () => {
    dir = await mkdtemp(join(tmpdir(), 'kira-media-'))
    const s = await storeFile(dir, ORG, Buffer.from('halaman'), 'png', new Date('2026-10-12T10:00:00Z'))
    expect(s.path).toMatch(new RegExp(`^${ORG}/2026-10/[0-9a-f-]{36}\\.png$`))
    expect(s.size).toBe(7)
    expect(s.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect((await stat(join(dir, 'media', s.path))).mode & 0o777).toBe(0o600)
    expect((await stat(join(dir, 'media', ORG))).mode & 0o777).toBe(0o700)
    expect((await readStored(dir, s.path)).toString()).toBe('halaman')
    await deleteStored(dir, s.path)
    await deleteStored(dir, s.path)
    await expect(readFile(join(dir, 'media', s.path))).rejects.toThrow()
    await expect(storeFile(dir, '../x', Buffer.from('x'), 'png')).rejects.toThrow()
  })
})

describe('loadEnv', () => {
  const base = {
    DATABASE_URL_WORKER: 'postgres://kira_worker:x@db:5432/kira',
    KIRA_DATA_DIR: '/data',
    KIRA_INTERNAL_TOKEN: 'a'.repeat(32),
    CLAUDE_MODEL_AUTHOR: 'claude-sonnet-5-5',
    CLAUDE_MODEL_FAST: 'claude-haiku-5-5',
  }

  it('nilai bawaan dan nilai kosong dianggap tidak diisi', () => {
    const env = loadEnv({ ...base, SMTP_URL: '', CLAUDE_CODE_OAUTH_TOKEN: '' })
    expect(env).toMatchObject({ AI_PROVIDER: 'claude-code', KIRA_INTERNAL_URL: 'http://web:3000', CLAUDE_BIN: 'claude' })
    expect(env.SMTP_URL).toBeUndefined()
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined()
  })

  it('pesan Indonesia yang menyebut variabelnya', () => {
    try {
      loadEnv({ KIRA_DATA_DIR: '/data', KIRA_INTERNAL_TOKEN: 'pendek', AI_PROVIDER: 'openai-compatible' })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError)
      const msg = (e as Error).message
      expect(msg).toMatch(/^Konfigurasi worker belum lengkap\./)
      expect(msg).toContain('DATABASE_URL_WORKER: wajib diisi')
      expect(msg).toContain('KIRA_INTERNAL_TOKEN: minimal 32 karakter')
      expect(msg).toContain('AI_BASE_URL: wajib diisi untuk AI_PROVIDER=openai-compatible')
      expect(msg).toContain('AI_MODEL: wajib diisi untuk AI_PROVIDER=openai-compatible')
      expect(msg).not.toMatch(/[\u2013\u2014]/)
    }
  })

  it('model Claude wajib untuk claude-code, SMTP_FROM wajib bila SMTP_URL diisi', () => {
    expect(() => loadEnv({ ...base, CLAUDE_MODEL_FAST: '' })).toThrow(/CLAUDE_MODEL_FAST: wajib diisi/)
    expect(() => loadEnv({ ...base, SMTP_URL: 'smtps://u:p@mail.example.test:465' })).toThrow(/SMTP_FROM/)
    expect(() => loadEnv({ ...base, SMTP_URL: 'http://mail' , SMTP_FROM: 'x' })).toThrow(/SMTP_URL: harus diawali smtp/)
    expect(loadEnv({ ...base, AI_PROVIDER: 'none', CLAUDE_MODEL_AUTHOR: '' }).AI_PROVIDER).toBe('none')
  })
})

describe('extractJson', () => {
  it('JSON langsung, dalam blok kode, atau di tengah teks', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('Here you go:\n```json\n{"a":2}\n```')).toEqual({ a: 2 })
    expect(extractJson('Answer: {"a":{"b":"}"}} done')).toEqual({ a: { b: '}' } })
    expect(extractJson('tidak ada')).toBeUndefined()
    expect(extractJson('42')).toBeUndefined()
  })
})
