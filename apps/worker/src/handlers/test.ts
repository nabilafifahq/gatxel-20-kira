import type { AiTestResult } from '@kira/db'
import { withOrg } from '@kira/db'
import { O } from '../ai/item-schema'
import { JobError, UsageLimitError, isAbortError, whenWib } from '../errors'
import { completeAiJobTx, failAiJob, loadAiJob, markAiRunning } from './ai-job'
import { TEST_PROMPT, TEST_SYSTEM } from './prompts'
import type { Handler, HandlerCtx } from './types'

/**
 * Job ai.test: tes koneksi provider dengan prompt kecil. Hasilnya `job.result` berbentuk
 * AiTestResult yang ditampilkan konsol. Tidak dicoba ulang: hasil gagal juga jawaban yang berguna.
 */

const TEST_SCHEMA = O({ ok: { type: 'boolean' } })

function okDetail(h: HandlerCtx, model: string, version: string | null): string {
  if (h.ai.name === 'claude-code') return `Terhubung ke Claude lewat langganan. Model: ${model}.${version ? ` ${version}.` : ''}`
  return `Terhubung ke ${version ?? 'server AI'}. Model: ${model}.`
}

export const testHandler: Handler = {
  async run(h) {
    const aj = await loadAiJob(h, 'test')
    await markAiRunning(h, aj.id)
    const base = { provider: h.ai.name, model: h.ai.modelFor('fast') }
    const fail = (detail: string): never => {
      const result: AiTestResult = { ok: false, detail, ...base }
      throw new JobError(detail, { retryable: false, result })
    }
    if (!h.ai.ready) fail(h.ai.notReadyReason ?? 'AI belum siap.')
    try {
      const out = await h.ai.run({ system: TEST_SYSTEM, prompt: TEST_PROMPT, jsonSchema: TEST_SCHEMA, tier: 'fast', timeoutMs: 120_000, signal: h.signal })
      const ok = typeof out.json === 'object' && out.json !== null && (out.json as { ok?: unknown }).ok === true
      if (!ok) fail('Terhubung, tetapi jawaban model tidak sesuai format yang diminta.')
      const result: AiTestResult = { ok: true, detail: okDetail(h, out.model, await h.ai.describe()), provider: h.ai.name, model: out.model }
      await withOrg(h.db, h.org, (tx) => completeAiJobTx(tx, aj.id, { output: result, provider: h.ai.name, model: out.model, durationMs: out.durationMs, usage: out.usage }, h.now()))
      return result
    } catch (e) {
      if (isAbortError(e) || (e instanceof JobError && e.result)) throw e
      if (e instanceof UsageLimitError) {
        fail(`Terhubung ke ${e.providerLabel}, tetapi batas pemakaian sedang tercapai${e.resetAt ? ` sampai ${whenWib(e.resetAt, h.now())}` : ''}. Coba lagi setelah itu.`)
      }
      if (e instanceof JobError) fail(e.message)
      h.log.error('tes koneksi AI gagal', { error: e })
      return fail('Tes koneksi gagal karena kesalahan di worker. Lihat log worker.')
    }
  },
  async onFailure(h, info) {
    await failAiJob(h, info, { output: { ok: false, detail: info.message, provider: h.ai.name, model: h.ai.modelFor('fast') } })
  },
}
