import { afterEach, describe, expect, it, vi } from 'vitest'
import { noteDbAccess, runHoldingTx, setTxGuardReporter, txHeld } from '@/server/tx-guard'

describe('penjaga transaksi bersarang', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('tidak melakukan apa pun di luar transaksi', () => {
    expect(txHeld()).toBe(false)
    expect(() => noteDbAccess('app')).not.toThrow()
  })

  it('tanda transaksi terbawa ke await di dalamnya dan hilang sesudahnya', async () => {
    const inside = await runHoldingTx(async () => {
      await Promise.resolve()
      return txHeld()
    })
    expect(inside).toBe(true)
    expect(txHeld()).toBe(false)
  })

  it('melempar saat pool app diminta di dalam transaksi pada tes', async () => {
    await expect(runHoldingTx(async () => noteDbAccess('app'))).rejects.toThrow(/Transaksi bersarang/)
  })

  it('hanya mencatat untuk pool auth, karena tidak bisa saling menunggu', async () => {
    const seen: string[] = []
    setTxGuardReporter((_m, meta) => seen.push(meta.pool))
    await runHoldingTx(async () => noteDbAccess('auth'))
    expect(seen).toEqual(['auth'])
  })

  it('di produksi tidak melempar dan mencatat sekali per tempat pemanggilan', async () => {
    vi.stubEnv('KIRA_TX_GUARD', 'log')
    const seen: string[] = []
    setTxGuardReporter((_m, meta) => seen.push(meta.where))
    const call = () => runHoldingTx(async () => noteDbAccess('app'))
    await call()
    await call()
    expect(seen).toHaveLength(1)
  })
})
