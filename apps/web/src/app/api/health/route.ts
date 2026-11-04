import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { appDb } from '@/server/db'
import { isReady } from '@/server/warm'

export const dynamic = 'force-dynamic'

/** Dipakai healthcheck Docker dan proxy. Lulus setelah konten dimuat dan database menjawab. Tidak membuka data apa pun. */
export async function GET() {
  if (!isReady()) return NextResponse.json({ ok: false, warming: true }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  try {
    await appDb().execute(sql`select 1`)
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
