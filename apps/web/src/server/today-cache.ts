import 'server-only'
import { kvConfigured, kvIncr, kvMGet, kvSet } from './kv'
import { getSession } from './auth/session'

/**
 * Cache layar Today per learner dan tanggal. Sah selama umurnya kurang dari TTL dan dua penanda versi tidak berubah:
 * versi learner (naik setiap Server Action sukses dari learner itu: jawaban, kumpul, peti, mulai sesi) dan versi org
 * (naik setiap Server Action sukses dari orang dewasa di org itu: aturan sesi, rencana, pengaturan). Perubahan di luar
 * itu (worker, jam berganti) terlihat paling lama TTL detik kemudian. Tanpa Valkey, cache ada di memori proses dengan
 * TTL lebih pendek dan versinya hanya dikenal replika itu.
 */

const TTL_S = 30
const LOCAL_TTL_MS = 5000

type Entry = { v: string; lv: string; ov: string; date: string }
const local = new Map<string, { at: number; e: Entry }>()
const localVer = new Map<string, number>()

const keyOf = (learnerId: string) => `td:${learnerId}`
const lverKey = (learnerId: string) => `tv:l:${learnerId}`
const overKey = (orgId: string) => `tv:o:${orgId}`

async function versions(learnerId: string, orgId: string): Promise<{ lv: string; ov: string; cached: string | null }> {
  if (kvConfigured()) {
    const [cached, lv, ov] = await kvMGet([keyOf(learnerId), lverKey(learnerId), overKey(orgId)])
    return { cached: cached ?? null, lv: lv ?? '0', ov: ov ?? '0' }
  }
  return { cached: null, lv: String(localVer.get(lverKey(learnerId)) ?? 0), ov: String(localVer.get(overKey(orgId)) ?? 0) }
}

export async function cachedToday<T>(who: { userId: string; orgId: string }, date: string, compute: () => Promise<T>): Promise<T> {
  const { lv, ov, cached } = await versions(who.userId, who.orgId)
  const valid = (e: Entry) => e.lv === lv && e.ov === ov && e.date === date
  if (cached) {
    try {
      const e = JSON.parse(cached) as Entry
      if (valid(e)) return JSON.parse(e.v) as T
    } catch {
      // cache rusak: hitung ulang
    }
  } else if (!kvConfigured()) {
    const l = local.get(who.userId)
    if (l && Date.now() - l.at < LOCAL_TTL_MS && valid(l.e)) return JSON.parse(l.e.v) as T
  }
  const data = await compute()
  const entry: Entry = { v: JSON.stringify(data), lv, ov, date }
  if (kvConfigured()) await kvSet(keyOf(who.userId), JSON.stringify(entry), TTL_S)
  else {
    local.set(who.userId, { at: Date.now(), e: entry })
    if (local.size > 2000) local.clear()
  }
  return data
}

async function bump(key: string): Promise<void> {
  if ((await kvIncr(key)) === null) localVer.set(key, (localVer.get(key) ?? 0) + 1)
  if (localVer.size > 5000) localVer.clear()
}

export async function invalidateLearnerToday(learnerId: string): Promise<void> {
  await bump(lverKey(learnerId))
}

export async function invalidateOrgToday(orgId: string): Promise<void> {
  await bump(overKey(orgId))
}

/** Dipanggil runAction setelah Server Action sukses. Tidak pernah melempar. */
export async function afterActionSuccess(): Promise<void> {
  try {
    const s = await getSession()
    if (!s) return
    await (s.role === 'learner' ? invalidateLearnerToday(s.userId) : invalidateOrgToday(s.orgId))
  } catch {
    // di luar request (uji) atau Valkey mati: TTL yang menjaga
  }
}
