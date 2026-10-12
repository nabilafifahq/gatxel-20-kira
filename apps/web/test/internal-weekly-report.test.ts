import { beforeEach, describe, expect, it, vi } from 'vitest'

const envState: { KIRA_INTERNAL_TOKEN?: string } = {}
vi.mock('@/server/env', () => ({ env: () => envState, origin: () => 'https://kira.test', isProd: () => false }))

const deliver = vi.fn()
vi.mock('@/server/dal/console-report', () => ({
  deliverWeekReport: (...args: unknown[]) => deliver(...args),
  safeErrorText: (e: unknown) => (e instanceof Error ? e.name : 'x'),
}))

const { POST } = await import('@/app/api/internal/weekly-report/route')

const TOKEN = 'k'.repeat(48)
const ORG = '7f1c2a9e-1111-4c2b-9d1e-0a1b2c3d4e5f'
const LEARNER = '2b9c4d1e-2222-4f3a-8b7c-1a2b3c4d5e6f'

function req(body: unknown, auth: string | null = `Bearer ${TOKEN}`) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (auth !== null) headers.authorization = auth
  return new Request('http://localhost/api/internal/weekly-report', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
}

const good = { orgId: ORG, learnerId: LEARNER, weekStart: '2026-10-12' }

beforeEach(() => {
  delete envState.KIRA_INTERNAL_TOKEN
  deliver.mockReset()
})

describe('POST /api/internal/weekly-report', () => {
  it('menjawab 503 dan tidak melakukan apa pun bila KIRA_INTERNAL_TOKEN kosong', async () => {
    const res = await POST(req(good))
    expect(res.status).toBe(503)
    expect(res.headers.get('content-type')).toContain('application/problem+json')
    const body = (await res.json()) as { requestId?: string }
    expect(body.requestId).toMatch(/^KR-/)
    expect(deliver).not.toHaveBeenCalled()
  })

  it('menolak token yang salah, header kosong, dan skema selain Bearer', async () => {
    envState.KIRA_INTERNAL_TOKEN = TOKEN
    for (const auth of [`Bearer ${'x'.repeat(48)}`, `Bearer ${TOKEN}x`, null, `Basic ${TOKEN}`, 'Bearer ']) {
      const res = await POST(req(good, auth))
      expect(res.status).toBe(401)
    }
    expect(deliver).not.toHaveBeenCalled()
  })

  it('menolak isi yang bukan JSON atau tidak sesuai skema', async () => {
    envState.KIRA_INTERNAL_TOKEN = TOKEN
    const bad = [
      '{not json',
      { ...good, orgId: 'bukan-uuid' },
      { orgId: ORG, learnerId: LEARNER },
      { ...good, weekStart: '2026-10-13' },
      { ...good, weekStart: '2026-02-30' },
      { ...good, extra: true },
    ]
    for (const b of bad) {
      const res = await POST(req(b))
      expect(res.status).toBe(400)
    }
    expect(deliver).not.toHaveBeenCalled()
  })

  it('mengantrekan laporan dengan konteks sistem org itu', async () => {
    envState.KIRA_INTERNAL_TOKEN = TOKEN
    deliver.mockResolvedValue({ queued: 2 })
    const res = await POST(req(good))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, queued: 2 })
    expect(deliver).toHaveBeenCalledTimes(1)
    const [ctx, input] = deliver.mock.calls[0] as [{ orgId: string; role: string }, Record<string, unknown>]
    expect(ctx).toMatchObject({ orgId: ORG, role: 'tutor' })
    expect(input).toEqual({ learnerId: LEARNER, weekStart: '2026-10-12', mode: 'scheduled', createdBy: null })
  })

  it('melewati minggu yang sudah terkirim tanpa error', async () => {
    envState.KIRA_INTERNAL_TOKEN = TOKEN
    deliver.mockResolvedValue({ queued: 0, skipped: 'already-sent' })
    const res = await POST(req(good))
    expect(await res.json()).toEqual({ ok: true, queued: 0, skipped: 'already-sent' })
  })

  it('error server menjadi 500 dengan kode referensi tanpa detail teknis', async () => {
    envState.KIRA_INTERNAL_TOKEN = TOKEN
    deliver.mockRejectedValue(new Error('Failed query: insert ... params: mama@contoh.test'))
    const res = await POST(req(good))
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).not.toContain('mama@contoh.test')
    expect(text).not.toContain('Failed query')
    expect(JSON.parse(text).requestId).toMatch(/^KR-/)
  })
})
