'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/lib/dto'
import { requireTutor } from '../auth/actor'
import { runAction } from '../errors'
import { createMcpTokenFor, revokeMcpTokenFor, runConnectionTest } from '../dal/console-claude'

/** T14: tes koneksi AI di worker (job ai.test), menunggu hasil paling lama 25 detik. */
export async function testConnectionAction(): Promise<ActionResult<{ detail: string }>> {
  return runAction('testConnection', async () => {
    const actor = await requireTutor()
    try {
      return await runConnectionTest(actor)
    } finally {
      // Status di halaman ikut hasil terbaru, termasuk saat tes gagal.
      refresh()
    }
  })
}

export async function createMcpTokenAction(name: string): Promise<ActionResult<{ token: string }>> {
  return runAction('createMcpToken', async () => {
    const actor = await requireTutor()
    const n = z.string().trim().min(1, 'Beri nama token, misalnya nama perangkatnya.').max(60, 'Nama token paling banyak 60 karakter.').parse(name)
    const result = await createMcpTokenFor(actor, n)
    refresh()
    return result
  })
}

export async function revokeMcpTokenAction(tokenId: string): Promise<ActionResult> {
  return runAction('revokeMcpToken', async () => {
    const actor = await requireTutor()
    await revokeMcpTokenFor(actor, z.string().uuid().parse(tokenId))
    refresh()
    return undefined
  })
}
