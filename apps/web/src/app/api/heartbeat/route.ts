import { NextResponse } from 'next/server'
import { jakartaDate } from '@kira/core'
import { inOrg } from '@/server/db'
import { getActor, orgCtx } from '@/server/auth/actor'
import { addMinutes, loadLearner } from '@/server/dal/learner-core'
import { sameOrigin } from '@/server/http'
import { throttleResponse } from '@/server/auth/ratelimit'
import { kvConfigured, kvGet, kvSet } from '@/server/kv'

export const dynamic = 'force-dynamic'

const recent = new Map<string, { at: number; body: string }>()
const RECENT_S = 45

/**
 * Detak waktu layar learner: klien mengirim tiap 2 menit. Detak yang datang dalam 45 detik dari detak sebelumnya
 * (tab ganda, ulang jaringan) dijawab dari cache tanpa membuka transaksi database.
 */
export async function POST(req: Request) {
  const actor = await getActor()
  if (!actor || actor.role !== 'learner') return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 })
  const limited = await throttleResponse('heartbeat', 30, actor.userId)
  if (limited) return limited
  const date = jakartaDate()
  const key = `hb:${actor.userId}:${date}`
  const cached = kvConfigured() ? await kvGet(key) : recent.get(key) && Date.now() - recent.get(key)!.at < RECENT_S * 1000 ? recent.get(key)!.body : null
  if (cached) return new NextResponse(cached, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  const result = await inOrg(orgCtx(actor), async (tx) => {
    const learner = await loadLearner(tx, actor.userId)
    const { minutes } = await addMinutes(tx, orgCtx(actor), actor.userId, date)
    return { minutes, limit: learner.screenLimitMin }
  })
  const body = JSON.stringify(result)
  if (kvConfigured()) await kvSet(key, body, RECENT_S)
  else {
    recent.set(key, { at: Date.now(), body })
    if (recent.size > 2000) recent.clear()
  }
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
