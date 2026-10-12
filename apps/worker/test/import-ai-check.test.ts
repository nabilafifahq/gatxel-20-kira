import { describe, expect, it } from 'vitest'
import type { ImportStoredItem } from '@kira/db'
import type { AiProvider, AiRunInput } from '../src/ai/types'
import { UsageLimitError } from '../src/errors'
import { aiKeyCheck } from '../src/handlers/import'
import type { HandlerCtx } from '../src/handlers/types'
import { log } from '../src/log'

const item = (number: number, answerFromKey: number | null, status: ImportStoredItem['status'] = 'ok'): ImportStoredItem => ({
  number, prompt: `Soal ${number}`, options: ['1', '2', '3', '4'], answer: answerFromKey, answerFromKey, figureNote: null, page: 1, status, approved: false, orgItemId: null,
})

function ctx(run: (i: AiRunInput) => Promise<unknown>, ready = true): { h: HandlerCtx; calls: AiRunInput[] } {
  const calls: AiRunInput[] = []
  const ai: AiProvider = {
    name: 'claude-code', label: 'Claude', model: 'm', ready, notReadyReason: null,
    modelFor: () => 'm', describe: async () => null,
    run: async (i) => {
      calls.push(i)
      return { json: await run(i), model: 'm', durationMs: 1 }
    },
  }
  return { h: { ai, log, signal: new AbortController().signal } as unknown as HandlerCtx, calls }
}

describe('aiKeyCheck', () => {
  it('nomor yang jawabannya berbeda dengan kunci ditandai; soal perlu dicek dan tanpa kunci tidak dikirim', async () => {
    const { h, calls } = ctx(async () => ({ answers: [{ number: 1, answer: 2 }, { number: 2, answer: 3 }, { number: 3, answer: null }] }))
    const r = await aiKeyCheck(h, [item(1, 2), item(2, 1), item(3, 0), item(4, null), item(5, 1, 'needs-check')], 'math', 2)
    expect([...r!.mismatched]).toEqual([2])
    const sent = JSON.parse(calls[0]!.prompt.slice(calls[0]!.prompt.indexOf('[')))
    expect(sent.map((q: { number: number }) => q.number)).toEqual([1, 2, 3])
    expect(sent[0].options[1]).toBe('B. 2')
  })

  it('gagal atau batas pemakaian: dilewati tanpa menggagalkan impor', async () => {
    const { h } = ctx(async () => {
      throw new UsageLimitError(null, 'Claude')
    })
    expect(await aiKeyCheck(h, [item(1, 0)], 'math', 2)).toBeNull()
  })

  it('provider belum siap: tidak dipanggil', async () => {
    const { h, calls } = ctx(async () => ({ answers: [] }), false)
    expect(await aiKeyCheck(h, [item(1, 0)], 'math', 2)).toBeNull()
    expect(calls).toHaveLength(0)
  })
})
