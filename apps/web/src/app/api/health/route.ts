import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { appDb } from '@/server/db'
import { isReady } from '@/server/warm'

export const dynamic = 'force-dynamic'

/**
 * Dipakai healthcheck Docker dan proxy. Lulus setelah konten dimuat dan database menjawab. Tidak membuka data apa pun.
 * Proxy memakai ?scope=live, tanpa database: database yang lambat atau pool yang penuh mengenai semua replika sekaligus, dan
 * mengeluarkan semua replika dari proxy mengubah lambat sebentar menjadi situs mati ("no upstreams").
 */
export async function GET(req: Request) {
  if (!isReady()) return NextResponse.json({ ok: false, warming: true }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  if (new URL(req.url).searchParams.get('scope') === 'live') return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  try {
    await appDb().execute(sql`select 1`)
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
